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
            "document_summary": {"verified": 0, "uploaded": 0, "required": 0, "total": 0},
            "documents": [],
        },
        "journey": [],
    }


@router.get("/notices")
def notices(_: dict = ParentUser) -> list[dict]:
    return []


@router.get("/profile")
def profile(user: dict = ParentUser) -> dict:
    return {"full_name": user["full_name"], "email": user["email"], "phone": "", "role": user["role"]}
