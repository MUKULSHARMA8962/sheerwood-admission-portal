from fastapi import APIRouter, Depends, HTTPException, status

from ..ai import AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError, generate_ai_reply
from ..dependencies import require_roles
from ..schemas import AIRequest, AnnouncementRequest, AssignmentRequest, AttendanceRequest

router = APIRouter(prefix="/api/teacher", tags=["Teacher UI"])
TeacherUser = Depends(require_roles("teacher"))

CLASSES: list[dict] = []
STUDENTS: list[dict] = []


@router.get("/dashboard")
def dashboard(_: dict = TeacherUser) -> dict:
    return {"summary": {"students": 0, "classes_today": 0, "pending_assignments": 0, "attendance": 0}, "today_classes": [], "recent_activity": []}


@router.get("/classes")
def classes(_: dict = TeacherUser) -> list[dict]:
    return CLASSES


@router.get("/students")
def students(_: dict = TeacherUser) -> list[dict]:
    return STUDENTS


@router.get("/attendance")
def attendance(_: dict = TeacherUser) -> dict:
    return {"class_section": "", "date": "", "summary": {"present": 0, "late": 0, "absent": 0}, "students": []}


@router.put("/attendance")
def save_attendance(payload: AttendanceRequest, _: dict = TeacherUser) -> dict:
    return {"message": "Attendance saved successfully.", "class_section": payload.class_section, "date": payload.date, "records": len(payload.records)}


@router.get("/assignments")
def assignments(_: dict = TeacherUser) -> list[dict]:
    return []


@router.post("/assignments", status_code=201)
def create_assignment(payload: AssignmentRequest, _: dict = TeacherUser) -> dict:
    return {"message": "Assignment created.", "assignment": payload.model_dump()}


@router.get("/marks")
def marks(_: dict = TeacherUser) -> dict:
    return {"exam": "", "class_section": "", "total_marks": 0, "class_average": 0, "records": []}


@router.get("/materials")
def materials(_: dict = TeacherUser) -> list[dict]:
    return []


@router.get("/timetable")
def timetable(_: dict = TeacherUser) -> list[dict]:
    return []


@router.get("/messages")
def messages(_: dict = TeacherUser) -> list[dict]:
    return []


@router.get("/announcements")
def announcements(_: dict = TeacherUser) -> list[dict]:
    return []


@router.post("/announcements", status_code=201)
def create_announcement(payload: AnnouncementRequest, _: dict = TeacherUser) -> dict:
    return {"message": "Announcement published.", "announcement": payload.model_dump()}


@router.get("/leaves")
def leaves(_: dict = TeacherUser) -> list[dict]:
    return [{"person": "Aarav Sharma", "class_section": "5A", "dates": "14–15 Jun", "reason": "Medical appointment", "status": "pending"}, {"person": "Vivaan Singh", "class_section": "5A", "dates": "13 Jun", "reason": "Family function", "status": "pending"}]


@router.post("/ai")
def ai_assistant(payload: AIRequest, _: dict = TeacherUser) -> dict:
    try:
        return {"answer": generate_ai_reply(payload.prompt, "teacher")}
    except AIConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service is not configured yet.") from error
    except AIProviderRateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="AI is busy right now. Please try again shortly.") from error
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service is temporarily unavailable. Please try again shortly.") from error
