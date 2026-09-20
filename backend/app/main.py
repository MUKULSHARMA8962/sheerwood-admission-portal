from contextlib import asynccontextmanager
from datetime import UTC, datetime
import hashlib
import os
import json
from pathlib import Path
import re
from typing import Annotated, Any
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Local development settings live in backend/.env. Server environment variables
# take priority, so production secrets can remain in the process/service config.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .database import connection, initialize_database
from .dependencies import CurrentUser, require_roles
from .notifications import send_admission_submission_notifications
from .otp import OTPConfigurationError, normalize_phone_number, verify_otp
from .referrals import resolve_referral
from .schemas import AdmissionDecisionRequest, CognitoTokenExchangeRequest, CreateApplicationRequest, LoginRequest, ParentalConsentRequest, ParentalConsentWithdrawalRequest, RegisterRequest, RegistrationFeePaymentRequest, SaveApplicationDraftRequest
from .security import hash_password, new_session_token, session_expiry, verify_password
from .routers import admin, ai, otp, parent, teacher


MAX_ADMISSION_DOCUMENT_BYTES = max(1, int(os.getenv("MAX_ADMISSION_DOCUMENT_BYTES", str(5 * 1024 * 1024))))
ADMISSION_DOCUMENT_KEYS = {
    "report-card",
    "aadhaar-card",
    "birth-certificate",
    "passport",
    "national-id-card",
    "student-photo",
    "father-photo",
    "mother-photo",
}
FINAL_APPLICATION_STATUSES = {"approved", "rejected"}
REQUIRED_ADMISSION_DOCUMENT_KEYS = {
    "report-card",
    "aadhaar-card",
    "birth-certificate",
    "passport",
    "national-id-card",
}
LEGACY_DOCUMENT_STATUSES = {"submitted": "uploaded", "approved": "verified"}
PARENTAL_CONSENT_VERSION = "v1.0"
PARENTAL_CONSENT_PURPOSES = [
    "LMS access",
    "Attendance tracking",
    "Academic progress tracking",
    "Parent or guardian communication",
]


def normalized_document_status(value: str) -> str:
    return LEGACY_DOCUMENT_STATUSES.get(value, value or "pending")


def otp_phone_number(value: str) -> str:
    """Match the portal's phone-number format before validating an SMS OTP."""
    digits = "".join(character for character in value if character.isdigit())
    if value.strip().startswith("+"):
        return normalize_phone_number(f"+{digits}")
    return normalize_phone_number(f"+91{digits}" if len(digits) == 10 else f"+{digits}")


def active_parental_consent(database: Any, application_number: str, parent_id: int) -> Any:
    """Return an active consent only when the latest ledger event is active."""
    latest_event = database.execute(
        """SELECT * FROM consent_events
        WHERE application_number = ? AND parent_id = ?
        ORDER BY id DESC LIMIT 1""",
        (application_number, parent_id),
    ).fetchone()
    return latest_event if latest_event and latest_event["status"] == "active" else None


def document_review_summary_for_rows(documents: list[Any]) -> tuple[str, dict[str, int]]:
    """Calculate the required-document aggregate used by verification and approval."""
    required_documents = [
        row for row in documents
        if "document_key" not in row.keys() or row["document_key"] in REQUIRED_ADMISSION_DOCUMENT_KEYS
    ]
    document_statuses = [normalized_document_status(row["status"]) for row in required_documents]
    counts = {
        "required": len(REQUIRED_ADMISSION_DOCUMENT_KEYS),
        "uploaded": len(required_documents),
        "verified": document_statuses.count("verified"),
        # Keep this alias while the existing parent status UI is updated.
        "approved": document_statuses.count("verified"),
        "pending": document_statuses.count("uploaded"),
        "under_verification": document_statuses.count("under_verification"),
        "reupload_required": document_statuses.count("reupload_required"),
        "rejected": document_statuses.count("rejected"),
    }
    if counts["rejected"] or counts["reupload_required"]:
        return "reupload_required", counts
    if counts["verified"] == counts["required"]:
        return "documents_verified", counts
    if counts["under_verification"]:
        return "under_verification", counts
    if counts["uploaded"]:
        return "uploaded", counts
    if not document_statuses:
        return "pending", counts
    return "pending", counts


def document_review_summary(database: Any, application_number: str) -> tuple[str, dict[str, int]]:
    """Return the authoritative aggregate from uploaded database documents.

    Browser draft metadata is deliberately not used here: an admin decision must
    never be replaced by an old localStorage draft submitted by a parent.
    """
    rows = database.execute(
        "SELECT document_key, status FROM admission_documents WHERE application_number = ?",
        (application_number,),
    ).fetchall()
    return document_review_summary_for_rows(rows)


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


def uploaded_file_content_type(content: bytes) -> str:
    """Identify supported document formats without trusting browser MIME data."""
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Upload a valid PDF, JPG, or PNG file.",
    )


def safe_upload_filename(filename: str | None, content_type: str) -> str:
    name = Path(filename or "document").name
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .") or "document"
    extension = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}[content_type]
    return name if name.lower().endswith(extension) else f"{name}{extension}"


def owned_application(database: Any, application_number: str, parent_id: int) -> Any:
    application = database.execute(
        "SELECT id, status, registration_fee_status, registration_fee_paid_at FROM applications WHERE application_number = ? AND parent_id = ?",
        (application_number, parent_id),
    ).fetchone()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission application was not found.")
    return application


def parent_admission_status_payload(database: Any, application_number: str, parent_id: int) -> dict[str, Any] | None:
    """Build the private live-status response for one parent-owned application."""
    application = database.execute(
        """SELECT application_number, student_name, parent_name, desired_class, status,
                  documents_status, verification_status, admin_remark, reupload_reason,
                  verification_date, verified_by, approval_date, approved_by,
                  registration_fee_status, registration_fee_paid_at,
                  submitted_on, class_section, section_allocation, application_data
           FROM applications WHERE application_number = ? AND parent_id = ?""",
        (application_number, parent_id),
    ).fetchone()
    if not application:
        return None
    documents = database.execute(
        """SELECT id, document_key, file_name, content_type, size_bytes, status, reason,
                  created_at, updated_at
           FROM admission_documents
           WHERE application_number = ? AND parent_id = ?
           ORDER BY document_key""",
        (application_number, parent_id),
    ).fetchall()
    application_payload = dict(application)
    try:
        application_data = json.loads(application_payload.pop("application_data") or "{}")
    except (TypeError, ValueError):
        application_data = {}
    guardians = application_data.get("guardians") if isinstance(application_data, dict) else {}
    guardian_details = next((details for details in guardians.values() if isinstance(details, dict) and details.get("mobile")), {}) if isinstance(guardians, dict) else {}
    application_payload["parent_mobile"] = str(guardian_details.get("mobile") or application_data.get("parentPhone") or "")
    # This endpoint is private to the parent who owns the application. Returning
    # their saved form data lets the dashboard render the same stage-wise values
    # after a refresh or sign-in on another device.
    application_payload["form_data"] = application_data
    document_list = [dict(document) for document in documents]
    _, counts = document_review_summary_for_rows(document_list)
    return {"application": application_payload, "documents": document_list, "document_summary": counts}


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
            "INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, 'parent', ?) RETURNING id",
            (email, f"{payload.first_name.strip()} {payload.last_name.strip()}", hash_password(payload.password)),
        )
        user = database.execute("SELECT id, email, full_name, role FROM users WHERE id = ?", (cursor.fetchone()["id"],)).fetchone()
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
            VALUES (?, ?, ?, ?, 'draft', 'pending', ?, ?) RETURNING id""",
            (application_number, payload.student_name, user["full_name"], payload.desired_class, datetime.now(UTC).date().isoformat(), user["id"]),
        )
        application = database.execute("SELECT * FROM applications WHERE id = ?", (cursor.fetchone()["id"],)).fetchone()
    return dict(application)


@app.post("/api/applications/{application_number}/registration-fee")
def record_registration_fee_payment(
    application_number: str,
    payload: RegistrationFeePaymentRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Record the completed registration-fee step for the portal payment flow."""
    paid_at = datetime.now(UTC).isoformat()
    with connection() as database:
        application = owned_application(database, application_number, user["id"])
        if application["status"] in FINAL_APPLICATION_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This admission already has a final decision.")
        active_consent = active_parental_consent(database, application_number, user["id"])
        if not active_consent:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Parent or guardian consent must be confirmed before payment.")
        if application["registration_fee_status"] == "paid":
            return {
                "application_number": application_number,
                "registration_fee_status": "paid",
                "registration_fee_paid_at": application["registration_fee_paid_at"],
                "method": payload.method,
            }
        notify_submission = application["status"] in {"", "draft", "needs_information"}
        _, document_counts = document_review_summary(database, application_number)
        if document_counts["uploaded"] < document_counts["required"]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload all required documents before paying the registration fee.")

        database.execute(
            """UPDATE applications
            SET registration_fee_status = 'paid', registration_fee_paid_at = ?,
                status = CASE WHEN status = 'draft' THEN 'pending' ELSE status END
            WHERE application_number = ? AND parent_id = ?""",
            (paid_at, application_number, user["id"]),
        )
        database.execute(
            """UPDATE new_admissions
            SET registration_fee_status = 'paid', registration_fee_paid_at = ?,
                status = CASE WHEN status = 'draft' THEN 'pending' ELSE status END,
                updated_at = ?
            WHERE application_number = ? AND parent_id = ?""",
            (paid_at, paid_at, application_number, user["id"]),
        )
        if notify_submission:
            saved_application = database.execute(
                "SELECT student_name, desired_class, application_data, documents_json FROM applications WHERE application_number = ? AND parent_id = ?",
                (application_number, user["id"]),
            ).fetchone()

    if notify_submission:
        try:
            saved_application_data = json.loads(saved_application["application_data"] or "{}")
        except (TypeError, json.JSONDecodeError):
            saved_application_data = {}
        try:
            saved_documents = json.loads(saved_application["documents_json"] or "[]")
        except (TypeError, json.JSONDecodeError):
            saved_documents = []
        background_tasks.add_task(
            send_admission_submission_notifications,
            parent_email=user["email"],
            parent_name=user["full_name"],
            student_name=saved_application["student_name"],
            application_number=application_number,
            desired_class=saved_application["desired_class"],
            application_data=saved_application_data if isinstance(saved_application_data, dict) else {},
            documents=saved_documents if isinstance(saved_documents, list) else [],
        )
    return {"application_number": application_number, "registration_fee_status": "paid", "registration_fee_paid_at": paid_at, "method": payload.method}


@app.post("/api/applications/{application_number}/parental-consent", status_code=status.HTTP_201_CREATED)
def record_parental_consent(
    application_number: str,
    payload: ParentalConsentRequest,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Add a Cognito-authenticated guardian consent event to the immutable ledger."""
    with connection() as database:
        application = owned_application(database, application_number, user["id"])
        if application["status"] in FINAL_APPLICATION_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Consent cannot be changed after a final admission decision.")

    try:
        parent_mobile = otp_phone_number(payload.parent_mobile)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    consent_id = str(uuid4())
    recorded_at = datetime.now(UTC).isoformat()
    client_ip = request.client.host if request.client else None
    with connection() as database:
        database.execute(
            """INSERT INTO consent_events
            (consent_id, application_number, parent_id, parent_name, parent_mobile, parent_email,
             child_name, child_dob, relationship_to_child, otp_verified, otp_verified_timestamp,
             consent_text_version, consent_given_timestamp, ip_address, purposes_consented, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')""",
            (
                consent_id,
                application_number,
                user["id"],
                payload.parent_name.strip(),
                parent_mobile,
                payload.parent_email.strip().lower(),
                payload.child_name.strip(),
                payload.child_dob,
                payload.relationship_to_child.strip(),
                False,
                recorded_at,
                PARENTAL_CONSENT_VERSION,
                recorded_at,
                client_ip,
                json.dumps(PARENTAL_CONSENT_PURPOSES),
            ),
        )
    return {
        "consent_id": consent_id,
        "status": "active",
        "otp_verified": False,
        "consent_text_version": PARENTAL_CONSENT_VERSION,
        "consent_given_timestamp": recorded_at,
    }


@app.post("/api/applications/{application_number}/parental-consent/withdraw", status_code=status.HTTP_201_CREATED)
def withdraw_parental_consent(
    application_number: str,
    payload: ParentalConsentWithdrawalRequest,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Append an OTP-verified withdrawal event without modifying the original consent."""
    with connection() as database:
        owned_application(database, application_number, user["id"])
        active_consent = active_parental_consent(database, application_number, user["id"])
    if not active_consent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active parental consent was found for this application.")

    try:
        parent_mobile = otp_phone_number(payload.parent_mobile)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    if parent_mobile != active_consent["parent_mobile"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Use the mobile number registered with the original consent.")
    try:
        otp_is_valid = verify_otp(parent_mobile, payload.otp)
    except OTPConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OTP service is not configured yet.") from error
    if not otp_is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is invalid, expired or has already been used.")

    withdrawal_id = str(uuid4())
    withdrawn_at = datetime.now(UTC).isoformat()
    client_ip = request.client.host if request.client else None
    with connection() as database:
        # Recheck under the write transaction so a consent cannot be withdrawn twice.
        active_consent = active_parental_consent(database, application_number, user["id"])
        if not active_consent:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This consent has already been withdrawn or replaced.")
        database.execute(
            """INSERT INTO consent_events
            (consent_id, application_number, parent_id, parent_name, parent_mobile, parent_email,
             child_name, child_dob, relationship_to_child, otp_verified, otp_verified_timestamp,
             consent_text_version, consent_given_timestamp, ip_address, purposes_consented, status,
             related_consent_id, withdrawn_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'withdrawn', ?, ?)""",
            (
                withdrawal_id,
                application_number,
                user["id"],
                active_consent["parent_name"],
                parent_mobile,
                active_consent["parent_email"],
                active_consent["child_name"],
                active_consent["child_dob"],
                active_consent["relationship_to_child"],
                True,
                withdrawn_at,
                active_consent["consent_text_version"],
                active_consent["consent_given_timestamp"],
                client_ip,
                active_consent["purposes_consented"],
                active_consent["consent_id"],
                withdrawn_at,
            ),
        )
    return {"consent_id": withdrawal_id, "status": "withdrawn", "withdrawn_timestamp": withdrawn_at}


@app.put("/api/applications/draft")
def save_application_draft(
    payload: SaveApplicationDraftRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    application_data = json.dumps(payload.data, ensure_ascii=True)
    documents_json = json.dumps(payload.documents, ensure_ascii=True)
    admission_details = payload.data.get("admissionDetails")
    if not isinstance(admission_details, dict):
        admission_details = {}
    student_details = payload.data.get("student")
    if not isinstance(student_details, dict):
        student_details = {}

    def admission_value(name: str, default: str = "") -> str:
        return str(admission_details.get(name) or payload.data.get(name) or default).strip()

    student_full_name = " ".join(part for part in (student_details.get("firstName"), student_details.get("lastName")) if part)
    student_name = str(payload.data.get("studentName") or payload.data.get("firstName") or student_full_name or "Application in progress").strip()
    desired_class = admission_value("class", "Class 4")
    board = admission_value("boardOther") if admission_value("board") == "Other" else admission_value("board")
    saved_on = datetime.now(UTC).date().isoformat()
    referral = resolve_referral(payload.lead_source, payload.referral_code)
    with connection() as database:
        existing = database.execute(
            """SELECT id, status, documents_status, registration_fee_status, lead_source,
                      vendor_id, campaign_id, referral_code, first_visit, submitted_at
               FROM applications WHERE application_number = ? AND parent_id = ?""",
            (payload.application_number, user["id"]),
        ).fetchone()
        if not existing:
            conflicting_application = database.execute(
                "SELECT parent_id FROM applications WHERE application_number = ?",
                (payload.application_number,),
            ).fetchone()
            if conflicting_application:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This application number belongs to another parent.")
        existing_new_admission = database.execute(
            """SELECT parent_id, status, documents_status, registration_fee_status, lead_source,
                      vendor_id, campaign_id, referral_code, first_visit, submitted_at
               FROM new_admissions WHERE application_number = ?""",
            (payload.application_number,),
        ).fetchone()
        if existing_new_admission and existing_new_admission["parent_id"] != user["id"]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This application number belongs to another parent.")

        # A parent can keep editing a draft, but cannot overwrite a decision made
        # by an administrator.  Document state is always derived from real BLOB
        # uploads in admission_documents, never from browser-only preview data.
        current_status = existing["status"] if existing else (existing_new_admission["status"] if existing_new_admission else "")
        incoming_status = "pending" if payload.status == "submitted" else payload.status
        fee_is_paid = (existing and existing["registration_fee_status"] == "paid") or (existing_new_admission and existing_new_admission["registration_fee_status"] == "paid")
        application_status = current_status if current_status in FINAL_APPLICATION_STATUSES or fee_is_paid else incoming_status
        notify_submission = payload.status == "submitted" and current_status in {"", "draft", "needs_information"}
        attribution_record = existing or existing_new_admission
        lead_source = referral.source if referral else str(attribution_record["lead_source"] or "") if attribution_record else ""
        vendor_id = referral.vendor_id if referral else str(attribution_record["vendor_id"] or "") if attribution_record else ""
        campaign_id = payload.campaign_id.strip() if referral and payload.campaign_id.strip() else referral.default_campaign_id if referral else str(attribution_record["campaign_id"] or "") if attribution_record else ""
        referral_code = referral.referral_code if referral else str(attribution_record["referral_code"] or "") if attribution_record else ""
        first_visit = payload.first_visit.strip() if referral and payload.first_visit.strip() else str(attribution_record["first_visit"] or "") if attribution_record else ""
        submitted_at = str(attribution_record["submitted_at"] or "") if attribution_record else ""
        if payload.status == "submitted" and not submitted_at:
            submitted_at = datetime.now(UTC).isoformat()
        documents_status, _ = document_review_summary(database, payload.application_number)
        if existing:
            database.execute(
                """UPDATE applications
                SET student_name = ?, desired_class = ?, status = ?, documents_status = ?,
                    application_data = ?, documents_json = ?, submitted_on = ?,
                    lead_source = ?, vendor_id = ?, campaign_id = ?, referral_code = ?,
                    first_visit = ?, submitted_at = ?
                WHERE id = ?""",
                (student_name, desired_class, application_status, documents_status, application_data, documents_json, saved_on, lead_source, vendor_id, campaign_id, referral_code, first_visit or None, submitted_at or None, existing["id"]),
            )
            application_id = existing["id"]
        else:
            cursor = database.execute(
                """INSERT INTO applications
                (application_number, student_name, parent_name, desired_class, status, documents_status, submitted_on, parent_id, application_data, documents_json, lead_source, vendor_id, campaign_id, referral_code, first_visit, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                (payload.application_number, student_name, user["full_name"], desired_class, application_status, documents_status, saved_on, user["id"], application_data, documents_json, lead_source, vendor_id, campaign_id, referral_code, first_visit or None, submitted_at or None),
            )
            application_id = cursor.fetchone()["id"]
        database.execute(
            """INSERT INTO new_admissions
            (application_number, parent_id, academic_session, application_date, class_applying_for,
             pen_number, previous_school, current_class, board, medium, student_name, status,
             documents_status, application_data, documents_json, lead_source, vendor_id, campaign_id,
             referral_code, first_visit, submitted_at, submitted_on, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(application_number) DO UPDATE SET
                parent_id = excluded.parent_id,
                academic_session = excluded.academic_session,
                application_date = excluded.application_date,
                class_applying_for = excluded.class_applying_for,
                pen_number = excluded.pen_number,
                previous_school = excluded.previous_school,
                current_class = excluded.current_class,
                board = excluded.board,
                medium = excluded.medium,
                student_name = excluded.student_name,
                status = excluded.status,
                documents_status = excluded.documents_status,
                application_data = excluded.application_data,
                documents_json = excluded.documents_json,
                lead_source = excluded.lead_source,
                vendor_id = excluded.vendor_id,
                campaign_id = excluded.campaign_id,
                referral_code = excluded.referral_code,
                first_visit = excluded.first_visit,
                submitted_at = excluded.submitted_at,
                submitted_on = excluded.submitted_on,
                updated_at = excluded.updated_at""",
            (
                payload.application_number,
                user["id"],
                admission_value("session"),
                admission_value("date"),
                desired_class,
                admission_value("penNumber"),
                admission_value("previousSchool"),
                admission_value("currentClass"),
                board,
                admission_value("medium"),
                student_name,
                application_status,
                documents_status,
                application_data,
                documents_json,
                lead_source,
                vendor_id,
                campaign_id,
                referral_code,
                first_visit or None,
                submitted_at or None,
                saved_on,
                saved_on,
            ),
        )
        application = database.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    if notify_submission:
        background_tasks.add_task(
            send_admission_submission_notifications,
            parent_email=user["email"],
            parent_name=user["full_name"],
            student_name=student_name,
            application_number=payload.application_number,
            desired_class=desired_class,
            application_data=payload.data,
            documents=payload.documents,
        )
    return dict(application)


@app.get("/api/applications/{application_number}/documents")
def list_admission_documents(
    application_number: str,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> list[dict[str, Any]]:
    """List metadata only; document bytes remain private in the database."""
    with connection() as database:
        owned_application(database, application_number, user["id"])
        rows = database.execute(
            """SELECT id, document_key, file_name, content_type, size_bytes, sha256,
                      status, reason, created_at, updated_at
            FROM admission_documents
            WHERE application_number = ? AND parent_id = ?
            ORDER BY document_key""",
            (application_number, user["id"]),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/applications/current/status")
def current_admission_status(
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Return the newest application for the signed-in parent after a refresh."""
    with connection() as database:
        row = database.execute(
            "SELECT application_number FROM applications WHERE parent_id = ? ORDER BY id DESC LIMIT 1",
            (user["id"],),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No admission application was found.")
        payload = parent_admission_status_payload(database, row["application_number"], user["id"])
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No admission application was found.")
    return payload


@app.get("/api/applications/{application_number}/status")
def admission_status(
    application_number: str,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Return the parent-visible, database-backed application and document status."""
    with connection() as database:
        payload = parent_admission_status_payload(database, application_number, user["id"])
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission application was not found.")
    return payload


@app.post("/api/applications/{application_number}/documents/{document_key}", status_code=status.HTTP_201_CREATED)
async def upload_admission_document(
    application_number: str,
    document_key: str,
    file: Annotated[UploadFile, File(...)],
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> dict[str, Any]:
    """Store an authenticated parent's admission document directly in the database."""
    if document_key not in ADMISSION_DOCUMENT_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown admission document type.")

    try:
        content = await file.read(MAX_ADMISSION_DOCUMENT_BYTES + 1)
    finally:
        await file.close()

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a file to upload.")
    if len(content) > MAX_ADMISSION_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Each document must be no larger than {MAX_ADMISSION_DOCUMENT_BYTES // (1024 * 1024)} MB.",
        )

    content_type = uploaded_file_content_type(content)
    file_name = safe_upload_filename(file.filename, content_type)
    uploaded_at = datetime.now(UTC).isoformat()
    digest = hashlib.sha256(content).hexdigest()

    with connection() as database:
        application = owned_application(database, application_number, user["id"])
        if application["status"] in {"approved", "rejected"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This admission has already received a final decision and its documents can no longer be changed.",
            )
        row = database.execute(
            """INSERT INTO admission_documents
            (application_number, parent_id, document_key, file_name, content_type, size_bytes,
             sha256, file_content, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)
            ON CONFLICT(application_number, document_key) DO UPDATE SET
                parent_id = excluded.parent_id,
                file_name = excluded.file_name,
                content_type = excluded.content_type,
                size_bytes = excluded.size_bytes,
                sha256 = excluded.sha256,
                file_content = excluded.file_content,
                status = 'uploaded',
                reason = '',
                updated_at = excluded.updated_at
            RETURNING id, document_key, file_name, content_type, size_bytes, status, updated_at""",
            (
                application_number,
                user["id"],
                document_key,
                file_name,
                content_type,
                len(content),
                digest,
                content,
                uploaded_at,
            ),
        ).fetchone()
        database.execute(
            "UPDATE applications SET documents_status = 'uploaded', verification_status = 'uploaded' WHERE application_number = ? AND parent_id = ?",
            (application_number, user["id"]),
        )
        database.execute(
            "UPDATE new_admissions SET documents_status = 'uploaded', verification_status = 'uploaded', updated_at = ? WHERE application_number = ? AND parent_id = ?",
            (uploaded_at, application_number, user["id"]),
        )
    return dict(row)


@app.get("/api/applications/{application_number}/documents/{document_key}")
def download_admission_document(
    application_number: str,
    document_key: str,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> Response:
    """Return a parent's stored document without exposing it publicly."""
    if document_key not in ADMISSION_DOCUMENT_KEYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission document was not found.")

    with connection() as database:
        owned_application(database, application_number, user["id"])
        document = database.execute(
            """SELECT file_name, content_type, file_content
            FROM admission_documents
            WHERE application_number = ? AND parent_id = ? AND document_key = ?""",
            (application_number, user["id"], document_key),
        ).fetchone()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission document was not found.")

    return Response(
        content=bytes(document["file_content"]),
        media_type=document["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{document["file_name"]}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.delete("/api/applications/{application_number}/documents/{document_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admission_document(
    application_number: str,
    document_key: str,
    user: Annotated[dict[str, Any], Depends(require_roles("parent"))],
) -> Response:
    """Remove one parent-owned document before the admission receives a final decision."""
    if document_key not in ADMISSION_DOCUMENT_KEYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission document was not found.")

    with connection() as database:
        application = owned_application(database, application_number, user["id"])
        if application["status"] in FINAL_APPLICATION_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This admission has received a final decision, so its documents can no longer be deleted.",
            )
        deleted = database.execute(
            "DELETE FROM admission_documents WHERE application_number = ? AND parent_id = ? AND document_key = ? RETURNING id",
            (application_number, user["id"], document_key),
        ).fetchone()
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission document was not found.")

        documents_status, _ = document_review_summary(database, application_number)
        database.execute(
            """UPDATE applications
            SET documents_status = ?, verification_status = ?, reupload_reason = '',
                verification_date = NULL, verified_by = ''
            WHERE application_number = ? AND parent_id = ?""",
            (documents_status, documents_status, application_number, user["id"]),
        )
        database.execute(
            """UPDATE new_admissions
            SET documents_status = ?, verification_status = ?, reupload_reason = '',
                verification_date = NULL, verified_by = '', updated_at = ?
            WHERE application_number = ? AND parent_id = ?""",
            (documents_status, documents_status, datetime.now(UTC).isoformat(), application_number, user["id"]),
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch("/api/applications/{application_id}/decision")
def decide_application(application_id: int, payload: AdmissionDecisionRequest, user: Annotated[dict[str, Any], Depends(require_roles("admin"))]) -> dict[str, Any]:
    with connection() as database:
        application = database.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not application:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
        documents_status, _ = document_review_summary(database, application["application_number"])
        is_exceptional_approval = payload.decision == "approve_with_exception"
        if application["status"] in FINAL_APPLICATION_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This admission already has a final decision.")
        if payload.decision == "approved" and documents_status != "documents_verified":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Approve Admission is available only after all required documents are verified.",
            )
        if is_exceptional_approval and documents_status == "documents_verified":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Use Approve Admission when all required documents are verified.")
        exception_reason = payload.admin_remark.strip()
        if is_exceptional_approval and not exception_reason:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A reason is required to approve with exception.")
        next_status = application["status"] if payload.decision == "remark" else "approved" if is_exceptional_approval else payload.decision
        updated_at = datetime.now(UTC).isoformat()
        approval_date = updated_at if payload.decision in {"approved", "approve_with_exception"} else application["approval_date"]
        approved_by = user["full_name"] if payload.decision in {"approved", "approve_with_exception"} else application["approved_by"]
        admin_remark = application["admin_remark"] if is_exceptional_approval else payload.admin_remark.strip() or application["admin_remark"]
        database.execute(
            """UPDATE applications
            SET status = ?, documents_status = ?, class_section = COALESCE(?, class_section),
                section_allocation = COALESCE(?, section_allocation), admin_remark = ?,
                approval_date = ?, approved_by = ?, approval_exception = ?, approval_exception_reason = ?
            WHERE id = ?""",
            (next_status, documents_status, payload.class_section, payload.section_allocation, admin_remark, approval_date, approved_by, int(is_exceptional_approval), exception_reason if is_exceptional_approval else "", application_id),
        )
        database.execute(
            """UPDATE new_admissions
            SET status = ?, documents_status = ?, section_allocation = COALESCE(?, section_allocation),
                admin_remark = ?, approval_date = ?, approved_by = ?, approval_exception = ?,
                approval_exception_reason = ?, updated_at = ?
            WHERE application_number = ?""",
            (next_status, documents_status, payload.section_allocation, admin_remark, approval_date, approved_by, int(is_exceptional_approval), exception_reason if is_exceptional_approval else "", updated_at, application["application_number"]),
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
