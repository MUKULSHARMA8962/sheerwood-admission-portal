from contextlib import asynccontextmanager
from datetime import UTC, datetime
import os
import json
from pathlib import Path
from typing import Annotated, Any

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Local development settings live in backend/.env. Server environment variables
# take priority, so production secrets can remain in the process/service config.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .database import connection, initialize_database
from .dependencies import CurrentUser, require_roles
from .schemas import AdmissionDecisionRequest, CognitoTokenExchangeRequest, CreateApplicationRequest, LoginRequest, RegisterRequest, SaveApplicationDraftRequest
from .security import hash_password, new_session_token, session_expiry, verify_password
from .routers import admin, ai, otp, parent, teacher


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Sheerwood Admission Portal API",
    version="1.0.0",
    description="FastAPI backend for Sheerwood parent, teacher and admin portals.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(parent.router)
app.include_router(teacher.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(otp.router)


def serialize_user(row: Any) -> dict[str, Any]:
    return {"id": row["id"], "email": row["email"], "full_name": row["full_name"], "role": row["role"]}


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "sheerwood-api"}


@app.post("/api/auth/cognito/token", include_in_schema=False)
async def exchange_cognito_code(payload: CognitoTokenExchangeRequest) -> JSONResponse:
    """Exchange a PKCE authorization code without ever exposing a client secret."""
    client_id = os.getenv("COGNITO_CLIENT_ID", "").strip()
    client_secret = os.getenv("COGNITO_CLIENT_SECRET", "").strip()
    domain = os.getenv("COGNITO_DOMAIN", "").rstrip("/")
    configured_redirect_uri = os.getenv("COGNITO_REDIRECT_URI", "").strip()

    if not all((client_id, client_secret, domain, configured_redirect_uri)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cognito confidential-client sign-in is not configured on this server.",
        )
    if payload.redirect_uri != configured_redirect_uri:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unexpected Cognito callback URL.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{domain}/oauth2/token",
                data={
                    "grant_type": "authorization_code",
                    "code": payload.code,
                    "redirect_uri": configured_redirect_uri,
                    "code_verifier": payload.code_verifier,
                },
                auth=(client_id, client_secret),
                headers={"Accept": "application/json"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Cognito is temporarily unavailable.") from exc

    try:
        token_data = response.json()
    except ValueError:
        token_data = {}

    if not response.is_success:
        cognito_error = token_data.get("error") if isinstance(token_data, dict) else None
        if cognito_error in {"invalid_client", "invalid_client_secret"}:
            detail = "The server-side Cognito client secret is invalid. Update backend/.env and restart the API."
        elif cognito_error == "invalid_grant":
            detail = "This Cognito sign-in link has expired. Please start sign-in again."
        elif cognito_error == "unauthorized_client":
            detail = "Cognito rejected this app client's authorization-code or callback configuration."
        elif cognito_error == "invalid_request":
            detail = "Cognito rejected an incomplete sign-in request. Please start sign-in again."
        else:
            detail = "Cognito could not complete this sign-in. Please start again."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    if not isinstance(token_data, dict) or not token_data.get("access_token") or not token_data.get("id_token"):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Cognito returned an incomplete sign-in response.")

    return JSONResponse(content=token_data, headers={"Cache-Control": "no-store", "Pragma": "no-cache"})


@app.get("/", tags=["System"])
def root() -> dict[str, str]:
    return {
        "message": "Sheerwood Admission Portal API is running.",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/favicon.ico", include_in_schema=False, status_code=status.HTTP_204_NO_CONTENT)
def favicon() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> dict[str, Any]:
    email = payload.email.strip().lower()
    with connection() as database:
        if database.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
        cursor = database.execute(
            "INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, 'parent', ?)",
            (email, f"{payload.first_name.strip()} {payload.last_name.strip()}", hash_password(payload.password)),
        )
        user = database.execute("SELECT id, email, full_name, role FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return {"message": "Parent account created successfully.", "user": serialize_user(user)}


@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    with connection() as database:
        user = database.execute("SELECT * FROM users WHERE email = ?", (payload.email.strip().lower(),)).fetchone()
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
        if user["role"] != payload.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"This account is registered as a {user['role']} account.")
        token = new_session_token()
        database.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user["id"], session_expiry()))
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: Annotated[str | None, Header()] = None) -> None:
    if authorization and authorization.startswith("Bearer "):
        with connection() as database:
            database.execute("DELETE FROM sessions WHERE token = ?", (authorization.removeprefix("Bearer ").strip(),))


@app.get("/api/auth/me")
def me(user: CurrentUser) -> dict[str, Any]:
    return user


@app.get("/api/dashboard/{role}")
def dashboard(role: str, user: CurrentUser) -> dict[str, Any]:
    if role not in {"parent", "teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown dashboard role.")
    if user["role"] != role and user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access this dashboard.")
    with connection() as database:
        applications = database.execute("SELECT COUNT(*) AS count FROM applications WHERE parent_id = ?", (user["id"],)).fetchone()["count"]
        total_applications = database.execute("SELECT COUNT(*) AS count FROM applications").fetchone()["count"]
        students = database.execute("SELECT COUNT(*) AS count FROM students").fetchone()["count"]
        teachers = database.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'").fetchone()["count"]
        pending_approvals = database.execute("SELECT COUNT(*) AS count FROM applications WHERE status IN ('pending', 'pending_approval', 'document_verification')").fetchone()["count"]
    data = {
        "parent": {"applications": applications, "documents_pending": 0, "payment_due": 0, "application_progress": 0},
        "teacher": {"students": students, "classes_today": 0, "pending_assignments": 0, "attendance": 0},
        "admin": {"students": students, "teachers": teachers, "new_applications": total_applications, "pending_approvals": pending_approvals, "fees_collected": 0, "attendance": 0},
    }
    return {"role": role, "user": user, "data": data[role]}


@app.get("/api/applications")
def list_applications(user: CurrentUser) -> list[dict[str, Any]]:
    with connection() as database:
        if user["role"] == "parent":
            rows = database.execute("SELECT * FROM applications WHERE parent_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        elif user["role"] == "admin":
            rows = database.execute("SELECT * FROM applications ORDER BY id DESC").fetchall()
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view applications.")
    return [dict(row) for row in rows]


@app.post("/api/applications", status_code=status.HTTP_201_CREATED)
def create_application(payload: CreateApplicationRequest, user: Annotated[dict[str, Any], Depends(require_roles("parent"))]) -> dict[str, Any]:
    with connection() as database:
        next_number = database.execute("SELECT COUNT(*) AS count FROM applications").fetchone()["count"] + 126
        application_number = f"AIS/2027-28/{next_number:06d}"
        cursor = database.execute(
            """INSERT INTO applications (application_number, student_name, parent_name, desired_class, status, documents_status, submitted_on, parent_id)
            VALUES (?, ?, ?, ?, 'draft', 'pending', ?, ?)""",
            (application_number, payload.student_name, user["full_name"], payload.desired_class, datetime.now(UTC).date().isoformat(), user["id"]),
        )
        application = database.execute("SELECT * FROM applications WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(application)


@app.put("/api/applications/draft")
def save_application_draft(payload: SaveApplicationDraftRequest, user: Annotated[dict[str, Any], Depends(require_roles("parent"))]) -> dict[str, Any]:
    application_data = json.dumps(payload.data, ensure_ascii=True)
    documents_json = json.dumps(payload.documents, ensure_ascii=True)
    student_name = str(payload.data.get("studentName") or payload.data.get("firstName") or "Application in progress").strip()
    desired_class = str(payload.data.get("class") or "Class 4").strip()
    with connection() as database:
        existing = database.execute(
            "SELECT id FROM applications WHERE application_number = ? AND parent_id = ?",
            (payload.application_number, user["id"]),
        ).fetchone()
        if existing:
            database.execute(
                """UPDATE applications
                SET student_name = ?, desired_class = ?, status = ?, documents_status = ?,
                    application_data = ?, documents_json = ?, submitted_on = ?
                WHERE id = ?""",
                (student_name, desired_class, payload.status, "submitted" if payload.documents else "pending", application_data, documents_json, datetime.now(UTC).date().isoformat(), existing["id"]),
            )
            application_id = existing["id"]
        else:
            cursor = database.execute(
                """INSERT INTO applications
                (application_number, student_name, parent_name, desired_class, status, documents_status, submitted_on, parent_id, application_data, documents_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (payload.application_number, student_name, user["full_name"], desired_class, payload.status, "submitted" if payload.documents else "pending", datetime.now(UTC).date().isoformat(), user["id"], application_data, documents_json),
            )
            application_id = cursor.lastrowid
        application = database.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    return dict(application)


@app.patch("/api/applications/{application_id}/decision")
def decide_application(application_id: int, payload: AdmissionDecisionRequest, _: Annotated[dict[str, Any], Depends(require_roles("admin"))]) -> dict[str, Any]:
    with connection() as database:
        application = database.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not application:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
        database.execute(
            "UPDATE applications SET status = ?, class_section = COALESCE(?, class_section) WHERE id = ?",
            (payload.decision, payload.class_section, application_id),
        )
        updated = database.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    return dict(updated)


@app.get("/api/students")
def list_students(_: Annotated[dict[str, Any], Depends(require_roles("admin", "teacher"))]) -> list[dict[str, Any]]:
    with connection() as database:
        rows = database.execute("SELECT * FROM students ORDER BY class_section, full_name").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/teachers")
def list_teachers(_: Annotated[dict[str, Any], Depends(require_roles("admin"))]) -> list[dict[str, Any]]:
    with connection() as database:
        rows = database.execute("SELECT id, full_name AS name, role FROM users WHERE role = 'teacher' ORDER BY full_name").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/documents")
def list_documents(_: Annotated[dict[str, Any], Depends(require_roles("admin"))]) -> list[dict[str, str]]:
    return []
