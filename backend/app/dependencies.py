import os
import secrets
from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

from .database import connection
from .security import hash_password


def serialize_user(row: Any) -> dict[str, Any]:
    # ``admission`` is the legacy/applicant Cognito role.  The API uses the
    # parent permissions for an applicant throughout the admission workflow.
    role = "parent" if row["role"] == "admission" else row["role"]
    return {"id": row["id"], "email": row["email"], "full_name": row["full_name"], "role": role}


def authentication_mode() -> str:
    return os.getenv("AUTH_MODE", "local").strip().lower()


def cognito_role(claims: dict[str, Any]) -> str:
    configured_claim = os.getenv("COGNITO_ROLE_CLAIM", "custom:role")
    groups = claims.get("cognito:groups") or []
    if not isinstance(groups, list):
        groups = []
    normalize = lambda value: str(value or "").strip().lower().replace(".", "")
    normalized_groups = [normalize(value) for value in groups]
    group_priority = ("admin", "teacher", "student", "parent", "admission", "vendor")
    group_role = next((role for role in group_priority if role in normalized_groups), None)
    claim_role = normalize(claims.get(configured_claim) or claims.get("custom:role") or claims.get("role"))
    return group_role or claim_role or normalize(os.getenv("COGNITO_DEFAULT_ROLE", "admission"))


@lru_cache(maxsize=1)
def cognito_configuration() -> tuple[str, str]:
    issuer = os.getenv("COGNITO_ISSUER", "").rstrip("/")
    client_id = os.getenv("COGNITO_CLIENT_ID", "").strip()
    if not issuer or not client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cognito authentication is not configured on this API.")
    return issuer, client_id


@lru_cache(maxsize=1)
def cognito_jwks_client() -> PyJWKClient:
    issuer, _ = cognito_configuration()
    return PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True, lifespan=300)


def validate_cognito_access_token(token: str) -> dict[str, Any]:
    issuer, client_id = cognito_configuration()
    try:
        signing_key = cognito_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(token, signing_key.key, algorithms=["RS256"], issuer=issuer, options={"verify_aud": False})
    except PyJWKClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cognito signing keys are temporarily unavailable.") from exc
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cognito access token is invalid or expired.") from exc

    if claims.get("token_use") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="An access token is required for this API.")
    if claims.get("client_id") != client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cognito access token was issued for a different app client.")
    return claims


def provision_cognito_user(claims: dict[str, Any]) -> dict[str, Any]:
    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cognito access token has no subject claim.")

    role = cognito_role(claims)
    database_role = "parent" if role == "admission" else role
    username = str(claims.get("username") or subject).strip()
    email = username.lower()
    full_name = str(claims.get("name") or username).strip()

    # Student, admission, and vendor sessions can still derive a local identity without
    # requiring a DB row when the project is using Cognito-only access.
    if role == "vendor":
        with connection() as database:
            vendor = database.execute(
                "SELECT vendor_id, is_enabled FROM vendor_accounts WHERE cognito_username = ? OR lower(email) = ?",
                (username, email),
            ).fetchone()
        if not vendor or not bool(vendor["is_enabled"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This vendor login has been disabled or is not provisioned.")
        return {"id": subject, "email": email, "full_name": full_name, "role": role, "vendor_id": vendor["vendor_id"]}

    if role == "student":
        return {"id": subject, "email": email, "full_name": full_name, "role": role}

    with connection() as database:
        user = database.execute("SELECT id, email, full_name, role FROM users WHERE cognito_subject = ?", (subject,)).fetchone()
        if not user:
            user = database.execute("SELECT id, email, full_name, role FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                database.execute("UPDATE users SET cognito_subject = ?, role = ? WHERE id = ?", (subject, database_role, user["id"]))
            else:
                cursor = database.execute(
                    "INSERT INTO users (email, full_name, role, password_hash, cognito_subject) VALUES (?, ?, ?, ?, ?) RETURNING id",
                    (email, full_name, database_role, hash_password(secrets.token_urlsafe(32)), subject),
                )
                user = database.execute("SELECT id, email, full_name, role FROM users WHERE id = ?", (cursor.fetchone()["id"],)).fetchone()
                return serialize_user(user)
            user = database.execute("SELECT id, email, full_name, role FROM users WHERE id = ?", (user["id"],)).fetchone()
    return serialize_user(user)


def authenticate_local_session(token: str) -> dict[str, Any]:
    with connection() as database:
        session = database.execute(
            """SELECT users.id, users.email, users.full_name, users.role, sessions.expires_at
            FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?""",
            (token,),
        ).fetchone()
    if not session or datetime.fromisoformat(session["expires_at"]) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or has expired.")
    return serialize_user(session)


def authenticate(authorization: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token is required.")
    token = authorization.removeprefix("Bearer ").strip()
    if authentication_mode() == "cognito":
        return provision_cognito_user(validate_cognito_access_token(token))
    if authentication_mode() == "local":
        return authenticate_local_session(token)
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AUTH_MODE must be 'cognito' or 'local'.")


CurrentUser = Annotated[dict[str, Any], Depends(authenticate)]


def require_roles(*roles: str):
    def dependency(user: CurrentUser) -> dict[str, Any]:
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action.")
        return user
    return dependency
