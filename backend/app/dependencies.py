from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status

from .database import connection


def serialize_user(row: Any) -> dict[str, Any]:
    return {"id": row["id"], "email": row["email"], "full_name": row["full_name"], "role": row["role"]}


def authenticate(authorization: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token is required.")
    token = authorization.removeprefix("Bearer ").strip()
    with connection() as database:
        session = database.execute(
            """SELECT users.id, users.email, users.full_name, users.role, sessions.expires_at
            FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?""",
            (token,),
        ).fetchone()
    if not session or datetime.fromisoformat(session["expires_at"]) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or has expired.")
    return serialize_user(session)


CurrentUser = Annotated[dict[str, Any], Depends(authenticate)]


def require_roles(*roles: str):
    def dependency(user: CurrentUser) -> dict[str, Any]:
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action.")
        return user
    return dependency
