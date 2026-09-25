from datetime import UTC, date, datetime
import json
import logging
import os
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
import boto3
from botocore.exceptions import BotoCoreError, ClientError

from ..ai import AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError, generate_ai_reply
from ..database import connection
from ..dependencies import require_roles
from ..schemas import AIRequest, AnnouncementRequest, CreateUserRequest, DocumentReviewRequest, RegistrationFeeSettingsRequest, SyllabusRequest, UserRoleUpdate, VendorCreateRequest
from ..security import hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin UI"])
AdminUser = Depends(require_roles("admin"))
logger = logging.getLogger(__name__)

DOCUMENT_LABELS = {
    "report-card": "Report Card",
    "aadhaar-card": "Aadhaar Card",
    "birth-certificate": "Birth Certificate",
    "passport": "Passport",
    "national-id-card": "National ID Card",
    "student-photo": "Student Photograph",
    "father-photo": "Father's Photograph",
    "mother-photo": "Mother's Photograph",
}
DOCUMENT_STATUS_LABELS = {
    "uploaded": "Uploaded",
    "under_verification": "Under Verification",
    "verified": "Verified",
    "reupload_required": "Re-upload Required",
    "rejected": "Rejected",
}
REQUIRED_DOCUMENT_KEYS = {"report-card", "aadhaar-card", "birth-certificate", "passport", "national-id-card"}
LEGACY_DOCUMENT_STATUSES = {"submitted": "uploaded", "approved": "verified"}


def document_status(value: str) -> str:
    return LEGACY_DOCUMENT_STATUSES.get(value, value or "pending")


def is_cognito_subject(value: str) -> bool:
    """Do not show Cognito's opaque subject UUID as a parent's display name."""
    return bool(re.fullmatch(r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}", value.strip(), re.IGNORECASE))


def document_summary(rows: list[dict]) -> tuple[str, dict[str, int]]:
    required_rows = [row for row in rows if row["document_key"] in REQUIRED_DOCUMENT_KEYS]
    statuses = [document_status(row["status"]) for row in required_rows]
    verified = statuses.count("verified")
    summary = {
        "required": len(REQUIRED_DOCUMENT_KEYS),
        "uploaded": len(required_rows),
        "verified": verified,
        "under_verification": statuses.count("under_verification"),
        "reupload_required": statuses.count("reupload_required"),
        "rejected": statuses.count("rejected"),
    }
    if summary["rejected"] or summary["reupload_required"]:
        return "reupload_required", summary
    if verified == summary["required"]:
        return "documents_verified", summary
    if summary["under_verification"]:
        return "under_verification", summary
    return ("uploaded" if summary["uploaded"] else "pending"), summary


def serialize_document(row: dict) -> dict:
    status_value = document_status(row["status"])
    return {
        "id": row["id"],
        "application_number": row["application_number"],
        "student": row["student_name"] or "Applicant",
        "document_key": row["document_key"],
        "document": DOCUMENT_LABELS.get(row["document_key"], row["document_key"].replace("-", " ").title()),
        "name": DOCUMENT_LABELS.get(row["document_key"], row["document_key"].replace("-", " ").title()),
        "file": row["file_name"],
        "content_type": row["content_type"],
        "size_bytes": row["size_bytes"],
        "status": DOCUMENT_STATUS_LABELS.get(status_value, status_value.replace("_", " ").title()),
        "status_code": status_value,
        "reason": row["reason"] or "",
        "updated_at": row["updated_at"],
    }


def document_row(database, document_id: int):
    return database.execute(
        """SELECT d.id, d.application_number, d.document_key, d.file_name, d.content_type,
                  d.size_bytes, d.status, d.reason, d.updated_at,
                  COALESCE(n.student_name, a.student_name, 'Applicant') AS student_name
           FROM admission_documents d
           LEFT JOIN new_admissions n ON n.application_number = d.application_number
           LEFT JOIN applications a ON a.application_number = d.application_number
           WHERE d.id = ?""",
        (document_id,),
    ).fetchone()


def cognito_admin_client():
    issuer = os.getenv("COGNITO_ISSUER", "").rstrip("/")
    user_pool_id = issuer.rsplit("/", 1)[-1]
    region = os.getenv("AWS_REGION", "us-east-1")
    if not user_pool_id:
        raise HTTPException(status_code=503, detail="Cognito user pool is not configured.")
    return boto3.client("cognito-idp", region_name=region), user_pool_id


def ensure_vendor_group(client, user_pool_id: str) -> None:
    """Create the dedicated vendor group once, without failing if it already exists."""
    try:
        client.create_group(UserPoolId=user_pool_id, GroupName="vendor", Description="Admission referral vendors")
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "GroupExistsException":
            raise


@router.get("/dashboard")
def dashboard(_: dict = AdminUser) -> dict:
    return {"summary": {"students": 1248, "teachers": 74, "new_applications": 126, "pending_approvals": 38, "fees_collected": 840000, "attendance": 93.6}, "priority_tasks": [{"title": "Admission approvals pending", "count": 38}, {"title": "Documents awaiting verification", "count": 12}, {"title": "Fee payment follow-ups", "count": 6}]}


@router.get("/admissions")
def admissions(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute("SELECT * FROM applications ORDER BY id DESC").fetchall()
        vendor_rows = database.execute("SELECT vendor_id, full_name FROM vendor_accounts").fetchall()
        vendor_names = {row["vendor_id"]: row["full_name"] for row in vendor_rows}
        result = []
        for row in rows:
            application = dict(row)
            documents = database.execute(
                """SELECT id, application_number, document_key, file_name, content_type, size_bytes, status, reason,
                          created_at, updated_at
                   FROM admission_documents WHERE application_number = ?""",
                (application["application_number"],),
            ).fetchall()
            documents_status, summary = document_summary(documents)
            try:
                application_data = json.loads(application.get("application_data") or "{}")
            except (TypeError, ValueError):
                application_data = {}
            guardians = application_data.get("guardians") if isinstance(application_data, dict) else {}
            guardian = next((details for details in guardians.values() if isinstance(details, dict) and details.get("mobile")), {}) if isinstance(guardians, dict) else {}
            saved_parent_name = str(application.get("parent_name") or "").strip()
            guardian_name = str(guardian.get("fullName") or "").strip()
            parent_name = guardian_name or saved_parent_name
            if is_cognito_subject(parent_name):
                parent_name = "Parent details pending"
            application.pop("application_data", None)
            application.pop("documents_json", None)
            application["vendor_name"] = vendor_names.get(application.get("vendor_id"), "")
            application.update({
                "documents_status": documents_status,
                "document_summary": summary,
                "parent_name": parent_name,
                "parent_mobile": str(guardian.get("mobile") or application_data.get("parentPhone") or ""),
                "form_data": application_data,
                "documents": [dict(document) for document in documents],
            })
            result.append(application)
    return result


@router.get("/admission-funnel")
def admission_funnel(_: dict = AdminUser) -> dict:
    """Return the live parent-to-submission funnel for the admin dashboard."""
    with connection() as database:
        applications = database.execute(
            """SELECT a.application_number, a.parent_id, a.status, a.registration_fee_status,
                      a.submitted_on, COALESCE(n.created_at, a.submitted_on) AS created_at
               FROM applications a
               LEFT JOIN new_admissions n ON n.application_number = a.application_number"""
        ).fetchall()
        document_rows = database.execute(
            """SELECT application_number, COUNT(DISTINCT document_key) AS uploaded
               FROM admission_documents
               WHERE document_key IN (?, ?, ?, ?, ?)
               GROUP BY application_number""",
            tuple(REQUIRED_DOCUMENT_KEYS),
        ).fetchall()
        parent_rows = database.execute(
            "SELECT id FROM users WHERE role IN ('parent', 'admission')"
        ).fetchall()

    documents_by_application = {row["application_number"]: int(row["uploaded"] or 0) for row in document_rows}
    parent_ids_with_applications = {row["parent_id"] for row in applications if row["parent_id"] is not None}
    active_applications = [row for row in applications if row["status"] not in {"approved", "rejected"}]
    submitted_applications = [row for row in active_applications if row["status"] != "draft"]
    pending_documents = [
        row for row in active_applications
        if documents_by_application.get(row["application_number"], 0) < len(REQUIRED_DOCUMENT_KEYS)
    ]
    pending_registration_fee = [
        row for row in active_applications
        if documents_by_application.get(row["application_number"], 0) >= len(REQUIRED_DOCUMENT_KEYS)
        and row["registration_fee_status"] != "paid"
    ]

    def submission_age_days(row) -> int:
        try:
            submitted_date = date.fromisoformat(str(row["submitted_on"] or row["created_at"] or "")[:10])
        except ValueError:
            return 0
        return max(0, (datetime.now(UTC).date() - submitted_date).days)

    submission_ages = [submission_age_days(row) for row in submitted_applications]
    return {
        "submitted": len(submitted_applications),
        "oldest_submission_days": max(submission_ages, default=0),
        "pending_documents": len(pending_documents),
        "pending_registration_fee": len(pending_registration_fee),
        "login_only": sum(row["id"] not in parent_ids_with_applications for row in parent_rows),
        "updated_at": datetime.now(UTC).isoformat(),
    }


@router.get("/students")
def students(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute("SELECT * FROM students ORDER BY class_section, full_name").fetchall()
    return [dict(row) for row in rows]


@router.get("/teachers")
def teachers(_: dict = AdminUser) -> list[dict]:
    return [{"id": "T-1042", "name": "Meera Kapoor", "subject": "Mathematics & Science", "class_teacher": "5A", "attendance": 96, "status": "active"}, {"id": "T-1043", "name": "Rohan Arora", "subject": "English", "class_teacher": "6B", "attendance": 94, "status": "active"}, {"id": "T-1044", "name": "Sonia Patel", "subject": "Biology", "class_teacher": "9A", "attendance": 91, "status": "on_leave"}]


@router.get("/classes")
def classes(_: dict = AdminUser) -> list[dict]:
    return [{"name": "Class 2", "sections": ["A", "B", "C"], "strength": 96, "class_teacher": "Anjali Mehta"}, {"name": "Class 5", "sections": ["A", "B", "C", "D"], "strength": 142, "class_teacher": "Meera Kapoor"}, {"name": "Class 10", "sections": ["A", "B"], "strength": 74, "class_teacher": "Kavita Singh"}]


@router.get("/attendance")
def attendance(_: dict = AdminUser) -> dict:
    return {"summary": {"percentage": 93.6, "present": 1168, "late": 43, "absent": 37}, "absent_alerts": [{"student": "Vivaan Singh", "class_section": "5A", "reason": "Second day absent"}, {"student": "Aarav Sharma", "class_section": "7B", "reason": "Medical leave pending"}]}


@router.get("/fees")
def fees(_: dict = AdminUser) -> dict:
    return {"summary": {"collected": 840000, "pending_dues": 126000, "concessions": 48000, "receipts": 1036}, "recent_transactions": [{"student": "Aarav Sharma", "class_section": "5A", "amount": 24500, "status": "paid"}, {"student": "Saanvi Gupta", "class_section": "5A", "amount": 24500, "status": "due"}]}


@router.get("/exams")
def exams(_: dict = AdminUser) -> list[dict]:
    return [{"name": "Unit Test 1", "classes": "2–8", "state": "marks_entry", "progress": 82}, {"name": "Mid Term Exam", "classes": "9–12", "state": "timetable_ready", "progress": 100}, {"name": "Science Quiz", "classes": "5A", "state": "review", "progress": 91}]


@router.get("/timetable")
def timetable(_: dict = AdminUser) -> list[dict]:
    return [{"time": "08:15", "class_section": "5A", "subject": "Mathematics", "teacher": "Meera Kapoor", "room": "204", "conflict": False}, {"time": "10:30", "class_section": "4B", "subject": "Science", "teacher": "Sonia Patel", "room": "Lab 02", "conflict": True}]


@router.get("/documents")
def documents(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute(
            """SELECT d.id, d.application_number, d.document_key, d.file_name, d.content_type,
                      d.size_bytes, d.status, d.reason, d.updated_at,
                      COALESCE(n.student_name, a.student_name, 'Applicant') AS student_name
               FROM admission_documents d
               LEFT JOIN new_admissions n ON n.application_number = d.application_number
               LEFT JOIN applications a ON a.application_number = d.application_number
               ORDER BY d.updated_at DESC"""
        ).fetchall()
    return [serialize_document(row) for row in rows]


@router.patch("/documents/{document_id}")
def review_document(document_id: int, payload: DocumentReviewRequest, user: dict = AdminUser) -> dict:
    updated_at = datetime.now(UTC).isoformat()
    with connection() as database:
        existing = database.execute(
            "SELECT application_number FROM admission_documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission document was not found.")
        database.execute(
            "UPDATE admission_documents SET status = ?, reason = ?, updated_at = ? WHERE id = ?",
            (payload.decision, payload.reason.strip(), updated_at, document_id),
        )
        all_documents = database.execute(
            "SELECT document_key, status FROM admission_documents WHERE application_number = ?",
            (existing["application_number"],),
        ).fetchall()
        document_status, _ = document_summary(all_documents)
        reupload_reason = payload.reason.strip() if payload.decision in {"reupload_required", "rejected"} else ""
        database.execute(
            """UPDATE applications
            SET documents_status = ?, verification_status = ?, reupload_reason = ?,
                verification_date = ?, verified_by = ?
            WHERE application_number = ?""",
            (document_status, document_status, reupload_reason, updated_at, user["full_name"], existing["application_number"]),
        )
        database.execute(
            """UPDATE new_admissions
            SET documents_status = ?, verification_status = ?, reupload_reason = ?,
                verification_date = ?, verified_by = ?, updated_at = ?
            WHERE application_number = ?""",
            (document_status, document_status, reupload_reason, updated_at, user["full_name"], updated_at, existing["application_number"]),
        )
        updated = document_row(database, document_id)
    return serialize_document(updated)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, _: dict = AdminUser) -> Response:
    """Remove an incorrect upload while an application is still under review."""
    with connection() as database:
        existing = database.execute(
            "SELECT application_number FROM admission_documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
        application = database.execute(
            "SELECT status FROM applications WHERE application_number = ?",
            (existing["application_number"],),
        ).fetchone()
        if application and application["status"] in {"approved", "rejected"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Documents cannot be deleted after a final admission decision.")

        database.execute("DELETE FROM admission_documents WHERE id = ?", (document_id,))
        all_documents = database.execute(
            "SELECT document_key, status FROM admission_documents WHERE application_number = ?",
            (existing["application_number"],),
        ).fetchall()
        document_status, _ = document_summary(all_documents)
        updated_at = datetime.now(UTC).isoformat()
        database.execute(
            """UPDATE applications
            SET documents_status = ?, verification_status = ?, reupload_reason = ''
            WHERE application_number = ?""",
            (document_status, document_status, existing["application_number"]),
        )
        database.execute(
            """UPDATE new_admissions
            SET documents_status = ?, verification_status = ?, reupload_reason = '', updated_at = ?
            WHERE application_number = ?""",
            (document_status, document_status, updated_at, existing["application_number"]),
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/documents/{document_id}/download")
def download_document(document_id: int, _: dict = AdminUser) -> Response:
    with connection() as database:
        document = database.execute(
            "SELECT file_name, content_type, file_content FROM admission_documents WHERE id = ?",
            (document_id,),
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


@router.get("/transport-hostel")
def transport_hostel(_: dict = AdminUser) -> dict:
    return {"transport": {"routes": 12, "buses": 18, "students_allocated": 864}, "hostel": {"residents": 328, "houses": 14, "rooms_available": 22}}


@router.get("/parents")
def parents(_: dict = AdminUser) -> list[dict]:
    return [{"name": "Mrs. Sharma", "student": "Aarav Sharma", "class_section": "5A", "last_interaction": "Meeting request"}, {"name": "Mr. Gupta", "student": "Saanvi Gupta", "class_section": "5A", "last_interaction": "Fee query"}]


@router.get("/notifications")
def notifications(_: dict = AdminUser) -> list[dict]:
    return [{"title": "Admission deadline extended", "audience": "All applicants", "channels": ["app", "email"]}, {"title": "Staff meeting reminder", "audience": "Teachers", "channels": ["app", "email"]}]


@router.post("/notifications", status_code=201)
def create_notification(payload: AnnouncementRequest, _: dict = AdminUser) -> dict:
    return {"message": "Notification delivered to the selected audience.", "notification": payload.model_dump()}


@router.get("/reports")
def reports(_: dict = AdminUser) -> list[dict]:
    return [{"name": "Admissions report", "value": "1,245 records"}, {"name": "Attendance report", "value": "93.6% average"}, {"name": "Fees report", "value": "₹8.4L collected"}, {"name": "Results report", "value": "78.6% average"}]


@router.get("/users-roles")
def users_roles(_: dict = AdminUser) -> list[dict]:
    client, user_pool_id = cognito_admin_client()
    users = []
    pagination_token = None
    try:
        while True:
            parameters = {"UserPoolId": user_pool_id, "Limit": 60}
            if pagination_token:
                parameters["PaginationToken"] = pagination_token
            response = client.list_users(**parameters)
            users.extend(response.get("Users", []))
            pagination_token = response.get("PaginationToken")
            if not pagination_token:
                break
        result = []
        for cognito_user in users:
            attributes = {item["Name"]: item["Value"] for item in cognito_user.get("Attributes", [])}
            groups = client.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=cognito_user["Username"]).get("Groups", [])
            group_names = [group["GroupName"] for group in groups]
            role = next((candidate for candidate in ("admin", "teacher", "student", "parent", "admission", "vendor") if candidate in group_names), "admission")
            result.append({"id": f"cognito:{cognito_user['Username']}", "email": attributes.get("email", ""), "full_name": attributes.get("name") or attributes.get("email", cognito_user["Username"]), "role": role, "cognito_subject": attributes.get("sub"), "groups": group_names, "status": cognito_user.get("UserStatus", "")})
        return result
    except (BotoCoreError, ClientError) as error:
        error_code = error.response.get("Error", {}).get("Code", "AWS credentials or permissions error") if isinstance(error, ClientError) else str(error)
        logger.exception("Cognito user listing failed: %s", error_code)
        raise HTTPException(status_code=503, detail=f"Cognito users could not be loaded: {error_code}") from error


@router.post("/users-roles", status_code=201)
def create_user(payload: CreateUserRequest, _: dict = AdminUser) -> dict:
    if payload.role == "vendor":
        raise HTTPException(status_code=400, detail="Create vendor logins from the Vendors section so a referral ID is assigned.")
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()
    password = (payload.password or secrets.token_urlsafe(16)).strip()

    if not full_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name is required.")
    if len(password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters long.")

    with connection() as database:
        if database.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")
        cursor = database.execute(
            "INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, ?, ?) RETURNING id",
            (email, full_name, payload.role, hash_password(password)),
        )
        row = database.execute("SELECT id, email, full_name, role, cognito_subject FROM users WHERE id = ?", (cursor.fetchone()["id"],)).fetchone()
    created = dict(row)
    created["temporary_password"] = password if payload.password is None else None
    return created


@router.patch("/users-roles/{user_id}")
def update_user_role(user_id: str, payload: UserRoleUpdate, _: dict = AdminUser) -> dict:
    if user_id.startswith("cognito:"):
        client, user_pool_id = cognito_admin_client()
        username = user_id.removeprefix("cognito:")
        try:
            groups = client.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=username).get("Groups", [])
            for group in ("admin", "teacher", "student", "parent", "admission", "vendor"):
                if any(item["GroupName"] == group for item in groups) and group != payload.role:
                    client.admin_remove_user_from_group(UserPoolId=user_pool_id, Username=username, GroupName=group)
            if payload.role == "vendor":
                with connection() as database:
                    vendor = database.execute("SELECT 1 FROM vendor_accounts WHERE cognito_username = ?", (username,)).fetchone()
                if not vendor:
                    raise HTTPException(status_code=400, detail="Create vendor logins from the Vendors section so a referral ID is assigned.")
                ensure_vendor_group(client, user_pool_id)
            client.admin_add_user_to_group(UserPoolId=user_pool_id, Username=username, GroupName=payload.role)
            client.admin_update_user_attributes(UserPoolId=user_pool_id, Username=username, UserAttributes=[{"Name": "name", "Value": payload.full_name}, {"Name": "email", "Value": payload.email}])
            return {"id": user_id, "email": payload.email, "full_name": payload.full_name, "role": payload.role, "cognito_subject": "", "groups": [payload.role]}
        except (BotoCoreError, ClientError) as error:
            error_code = error.response.get("Error", {}).get("Code", "AWS credentials or permissions error") if isinstance(error, ClientError) else str(error)
            logger.exception("Cognito role update failed: %s", error_code)
            raise HTTPException(status_code=503, detail=f"Cognito role could not be updated: {error_code}") from error
    with connection() as database:
        cursor = database.execute("UPDATE users SET role = ?, full_name = ?, email = ? WHERE id = ?", (payload.role, payload.full_name, payload.email, user_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User was not found.")
        row = database.execute("SELECT id, email, full_name, role, cognito_subject FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row)


@router.get("/vendors")
def list_vendors(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute(
            """SELECT v.vendor_id, v.full_name, v.email, v.cognito_username, v.referral_code,
                      v.is_enabled, v.created_at, v.updated_at,
                      COUNT(a.id) AS applications,
                      SUM(CASE WHEN a.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted,
                      SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS approved
               FROM vendor_accounts v
               LEFT JOIN applications a ON a.vendor_id = v.vendor_id
               GROUP BY v.vendor_id, v.full_name, v.email, v.cognito_username, v.referral_code,
                        v.is_enabled, v.created_at, v.updated_at
               ORDER BY v.created_at DESC"""
        ).fetchall()
    return [{**dict(row), "is_enabled": bool(row["is_enabled"]), "applications": int(row["applications"] or 0), "submitted": int(row["submitted"] or 0), "approved": int(row["approved"] or 0)} for row in rows]


@router.post("/vendors", status_code=201)
def create_vendor(payload: VendorCreateRequest, _: dict = AdminUser) -> dict:
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()
    vendor_id = payload.vendor_id.strip().upper()
    if not full_name or not email:
        raise HTTPException(status_code=400, detail="Vendor name and email are required.")

    with connection() as database:
        existing = database.execute("SELECT 1 FROM vendor_accounts WHERE vendor_id = ? OR lower(email) = ?", (vendor_id, email)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="A vendor with this referral ID or email already exists.")

    client, user_pool_id = cognito_admin_client()
    try:
        ensure_vendor_group(client, user_pool_id)
        response = client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": full_name},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
        username = response["User"]["Username"]
        client.admin_add_user_to_group(UserPoolId=user_pool_id, Username=username, GroupName="vendor")
    except ClientError as error:
        error_code = error.response.get("Error", {}).get("Code", "Cognito error")
        if error_code == "UsernameExistsException":
            raise HTTPException(status_code=409, detail="A Cognito account already exists for this vendor email.") from error
        logger.exception("Vendor creation failed: %s", error_code)
        raise HTTPException(status_code=503, detail=f"Vendor login could not be created: {error_code}") from error

    try:
        with connection() as database:
            database.execute(
                """INSERT INTO vendor_accounts (vendor_id, full_name, email, cognito_username, referral_code)
                   VALUES (?, ?, ?, ?, ?)""",
                (vendor_id, full_name, email, username, vendor_id),
            )
    except Exception:
        try:
            client.admin_delete_user(UserPoolId=user_pool_id, Username=username)
        except (BotoCoreError, ClientError):
            logger.exception("Could not remove the Cognito vendor user after database creation failed.")
        raise
    return {"vendor_id": vendor_id, "full_name": full_name, "email": email, "cognito_username": username, "referral_code": vendor_id, "is_enabled": True, "status": "Invitation sent"}


@router.patch("/vendors/{vendor_id}/status")
def update_vendor_status(vendor_id: str, enabled: bool, _: dict = AdminUser) -> dict:
    normalized_vendor_id = vendor_id.strip().upper()
    with connection() as database:
        vendor = database.execute("SELECT cognito_username FROM vendor_accounts WHERE vendor_id = ?", (normalized_vendor_id,)).fetchone()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor account was not found.")
    client, user_pool_id = cognito_admin_client()
    try:
        (client.admin_enable_user if enabled else client.admin_disable_user)(UserPoolId=user_pool_id, Username=vendor["cognito_username"])
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=503, detail="Vendor account status could not be changed.") from error
    with connection() as database:
        database.execute("UPDATE vendor_accounts SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?", (int(enabled), normalized_vendor_id))
    return {"vendor_id": normalized_vendor_id, "is_enabled": enabled, "status": "Enabled" if enabled else "Blocked"}


@router.get("/settings")
def settings(_: dict = AdminUser) -> dict:
    with connection() as database:
        fee = database.execute("SELECT setting_value FROM school_settings WHERE setting_key = 'registration_fee_amount'").fetchone()
    return {"school_name": "Sheerwood College", "academic_session": "2027–28", "branches": 1, "classes": "2–12", "subjects": 42, "registration_fee_amount": int(fee["setting_value"] if fee else 1500), "notification_channels": ["app", "email", "sms"]}


@router.patch("/settings/registration-fee")
def update_registration_fee(payload: RegistrationFeeSettingsRequest, _: dict = AdminUser) -> dict:
    with connection() as database:
        database.execute("INSERT INTO school_settings (setting_key, setting_value, updated_at) VALUES ('registration_fee_amount', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at", (str(payload.amount),))
    return {"registration_fee_amount": payload.amount}


@router.get("/syllabus")
def list_syllabus(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute("SELECT id, subject, details, sort_order, active, updated_at FROM entrance_syllabus ORDER BY sort_order, id").fetchall()
    return [dict(row) for row in rows]


@router.post("/syllabus", status_code=201)
def create_syllabus(payload: SyllabusRequest, _: dict = AdminUser) -> dict:
    with connection() as database:
        row = database.execute("INSERT INTO entrance_syllabus (subject, details, sort_order, active) VALUES (?, ?, ?, ?) RETURNING id, subject, details, sort_order, active, updated_at", (payload.subject.strip(), payload.details.strip(), payload.sort_order, int(payload.active))).fetchone()
    return dict(row)


@router.patch("/syllabus/{syllabus_id}")
def update_syllabus(syllabus_id: int, payload: SyllabusRequest, _: dict = AdminUser) -> dict:
    with connection() as database:
        row = database.execute("UPDATE entrance_syllabus SET subject = ?, details = ?, sort_order = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, subject, details, sort_order, active, updated_at", (payload.subject.strip(), payload.details.strip(), payload.sort_order, int(payload.active), syllabus_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Syllabus item was not found.")
    return dict(row)


@router.delete("/syllabus/{syllabus_id}", status_code=204)
def delete_syllabus(syllabus_id: int, _: dict = AdminUser) -> None:
    with connection() as database:
        result = database.execute("DELETE FROM entrance_syllabus WHERE id = ?", (syllabus_id,))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Syllabus item was not found.")


@router.patch("/users-roles/{user_id}/status")
def update_user_status(user_id: str, enabled: bool, _: dict = AdminUser) -> dict:
    if not user_id.startswith("cognito:"):
        raise HTTPException(status_code=400, detail="Only Cognito vendor accounts can be blocked from this endpoint.")
    client, user_pool_id = cognito_admin_client()
    username = user_id.removeprefix("cognito:")
    try:
        (client.admin_enable_user if enabled else client.admin_disable_user)(UserPoolId=user_pool_id, Username=username)
        return {"id": user_id, "enabled": enabled, "status": "Enabled" if enabled else "Disabled"}
    except (BotoCoreError, ClientError) as error:
        raise HTTPException(status_code=503, detail="Vendor account status could not be changed.") from error


@router.post("/ai")
def ai_assistant(payload: AIRequest, _: dict = AdminUser) -> dict:
    try:
        return {"answer": generate_ai_reply(payload.prompt, "admin")}
    except AIConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service is not configured yet.") from error
    except AIProviderRateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="AI is busy right now. Please try again shortly.") from error
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service is temporarily unavailable. Please try again shortly.") from error
