from fastapi import APIRouter, Depends

from ..database import connection
from ..dependencies import require_roles

router = APIRouter(prefix="/api/parent", tags=["Parent UI"])
ParentUser = Depends(require_roles("parent"))


@router.get("/dashboard")
def dashboard(user: dict = ParentUser) -> dict:
    with connection() as database:
        applications = database.execute("SELECT * FROM applications WHERE parent_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
    active_application = dict(applications[0]) if applications else None
    documents = []
    if active_application:
        with connection() as database:
            documents = [dict(row) for row in database.execute(
                """SELECT id, document_key, file_name, content_type, size_bytes, status,
                          reason, created_at, updated_at
                   FROM admission_documents
                   WHERE application_number = ? AND parent_id = ?
                   ORDER BY document_key""",
                (active_application["application_number"], user["id"]),
            ).fetchall()]

    document_summary = {
        "verified": sum(document["status"] == "approved" for document in documents),
        "uploaded": len(documents),
        "pending": sum(document["status"] == "submitted" for document in documents),
        "reupload_required": sum(document["status"] == "reupload_required" for document in documents),
        # Requirements can vary by class; total means currently uploaded files.
        "required": 0,
        "total": len(documents),
    }
    return {
        "summary": {
            "applications": len(applications),
            "in_progress": sum(application["status"] in {"draft", "new_application"} for application in applications),
            "submitted": sum(application["status"] in {"submitted", "document_verification", "pending_approval"} for application in applications),
            "approved": sum(application["status"] == "approved" for application in applications),
        },
        "applications": [dict(application) for application in applications],
        "admission_overview": {
            "application": active_application,
            "approval_status": active_application["status"] if active_application else "not_started",
            "progress_percent": 0,
            "document_summary": document_summary,
            "documents": documents,
        },
        "journey": [],
    }


@router.get("/notices")
def notices(_: dict = ParentUser) -> list[dict]:
    return []


@router.get("/profile")
def profile(user: dict = ParentUser) -> dict:
    return {"full_name": user["full_name"], "email": user["email"], "phone": "", "role": user["role"]}
