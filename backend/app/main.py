from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

# Local development settings live in backend/.env. Server environment variables
# take priority, so production secrets can remain in the process/service config.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .database import connection, initialize_database
from .schemas import AdmissionDecisionRequest, CreateApplicationRequest, LoginRequest, RegisterRequest
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


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "sheerwood-api"}


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
    data = {
        "parent": {"applications": 1, "documents_pending": 1, "payment_due": 1900, "application_progress": 60},
        "teacher": {"students": 128, "classes_today": 4, "pending_assignments": 12, "attendance": 94},
        "admin": {"students": 1248, "teachers": 74, "new_applications": 126, "pending_approvals": 38, "fees_collected": 840000, "attendance": 93.6},
    }
    return {"role": role, "user": user, "data": data[role]}


@app.get("/api/applications")
def list_applications(user: CurrentUser) -> list[dict[str, Any]]:
    with connection() as database:
        if user["role"] == "parent":
            rows = database.execute("SELECT * FROM applications WHERE parent_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        else:
            rows = database.execute("SELECT * FROM applications ORDER BY id DESC").fetchall()
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
    return [
        {"id": "T-1042", "name": "Meera Kapoor", "subject": "Mathematics & Science", "class_teacher": "Class 5A", "attendance": 96},
        {"id": "T-1043", "name": "Rohan Arora", "subject": "English", "class_teacher": "Class 6B", "attendance": 94},
        {"id": "T-1044", "name": "Sonia Patel", "subject": "Biology", "class_teacher": "Class 9A", "attendance": 91},
    ]


@app.get("/api/documents")
def list_documents(_: Annotated[dict[str, Any], Depends(require_roles("admin"))]) -> list[dict[str, str]]:
    return [
        {"student": "Aadhya Sharma", "document": "Birth Certificate", "status": "verified"},
        {"student": "Aadhya Sharma", "document": "Aadhaar Card", "status": "verified"},
        {"student": "Vivaan Singh", "document": "Transfer Certificate", "status": "pending"},
    ]
