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
        "summary": {"applications": len(applications), "in_progress": 1, "submitted": 1, "approved": 0},
        "applications": [dict(application) for application in applications],
        "admission_overview": {
            "application": active_application,
            "approval_status": "pending" if active_application else "not_started",
            "progress_percent": 78 if active_application else 0,
            "document_summary": {"verified": 4, "uploaded": 0, "required": 1, "total": 5},
            "documents": [
                {"name": "Birth Certificate", "status": "verified"},
                {"name": "Aadhaar Card", "status": "verified"},
                {"name": "Passport Photograph", "status": "verified"},
                {"name": "Medical Certificate", "status": "verified"},
                {"name": "Transfer Certificate", "status": "required"},
            ],
        },
        "journey": [
            {"name": "Admission Details", "progress": 100, "state": "complete"},
            {"name": "Student Information", "progress": 100, "state": "complete"},
            {"name": "Parent / Guardian", "progress": 100, "state": "complete"},
            {"name": "Residential Information", "progress": 100, "state": "complete"},
            {"name": "Academic Background", "progress": 60, "state": "in_progress"},
            {"name": "Document Upload", "progress": 30, "state": "in_progress"},
        ],
    }


@router.get("/notices")
def notices(_: dict = ParentUser) -> list[dict]:
    return [
        {"title": "Application deadline extended", "message": "The last date to submit applications is 31 May 2027.", "time": "2 hours ago"},
        {"title": "Admission test schedule", "message": "Class 1–8 test will be held on 15 June 2027.", "time": "1 day ago"},
    ]


@router.get("/profile")
def profile(user: dict = ParentUser) -> dict:
    return {"full_name": user["full_name"], "email": user["email"], "phone": "+91 98765 43210", "role": "Parent"}
