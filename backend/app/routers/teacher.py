from fastapi import APIRouter, Depends, HTTPException, status

from ..ai import AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError, generate_ai_reply
from ..dependencies import require_roles
from ..schemas import AIRequest, AnnouncementRequest, AssignmentRequest, AttendanceRequest

router = APIRouter(prefix="/api/teacher", tags=["Teacher UI"])
TeacherUser = Depends(require_roles("teacher"))

CLASSES = [
    {"name": "Class 5A", "subject": "Mathematics", "students": 36, "attendance": 92, "time": "08:15 – 09:00"},
    {"name": "Class 5B", "subject": "Mathematics", "students": 34, "attendance": 94, "time": "09:10 – 09:55"},
    {"name": "Class 4A", "subject": "Science", "students": 31, "attendance": 96, "time": "10:30 – 11:15"},
]
STUDENTS = [
    {"name": "Aarav Sharma", "roll_no": "24", "class_section": "5A", "attendance": 96, "performance": "Excellent", "parent_phone": "+91 98765 23120"},
    {"name": "Saanvi Gupta", "roll_no": "18", "class_section": "5A", "attendance": 92, "performance": "Good", "parent_phone": "+91 98765 16780"},
    {"name": "Vivaan Singh", "roll_no": "31", "class_section": "5A", "attendance": 88, "performance": "Needs support", "parent_phone": "+91 98765 44321"},
]


@router.get("/dashboard")
def dashboard(_: dict = TeacherUser) -> dict:
    return {"summary": {"students": 128, "classes_today": 4, "pending_assignments": 12, "attendance": 94}, "today_classes": CLASSES, "recent_activity": [{"student": "Aarav Sharma", "event": "Assignment submitted"}, {"student": "Saanvi Gupta", "event": "Parent message received"}]}


@router.get("/classes")
def classes(_: dict = TeacherUser) -> list[dict]:
    return CLASSES


@router.get("/students")
def students(_: dict = TeacherUser) -> list[dict]:
    return STUDENTS


@router.get("/attendance")
def attendance(_: dict = TeacherUser) -> dict:
    return {"class_section": "5A", "date": "2027-06-12", "summary": {"present": 34, "late": 1, "absent": 1}, "students": [{**student, "status": "Present" if index != 2 else "Late"} for index, student in enumerate(STUDENTS)]}


@router.put("/attendance")
def save_attendance(payload: AttendanceRequest, _: dict = TeacherUser) -> dict:
    return {"message": "Attendance saved successfully.", "class_section": payload.class_section, "date": payload.date, "records": len(payload.records)}


@router.get("/assignments")
def assignments(_: dict = TeacherUser) -> list[dict]:
    return [{"title": "Fractions practice worksheet", "class_section": "5A", "due_date": "2027-06-14", "submitted": 28, "pending": 8}, {"title": "Plant life observation journal", "class_section": "4A", "due_date": "2027-06-15", "submitted": 24, "pending": 7}]


@router.post("/assignments", status_code=201)
def create_assignment(payload: AssignmentRequest, _: dict = TeacherUser) -> dict:
    return {"message": "Assignment created.", "assignment": payload.model_dump()}


@router.get("/marks")
def marks(_: dict = TeacherUser) -> dict:
    return {"exam": "Mathematics Unit Test 1", "class_section": "5A", "total_marks": 100, "class_average": 78.6, "records": [{"student": "Aarav Sharma", "marks": 84, "grade": "B+", "remark": "Strong conceptual understanding"}, {"student": "Saanvi Gupta", "marks": 77, "grade": "B+", "remark": "Practice word problems"}]}


@router.get("/materials")
def materials(_: dict = TeacherUser) -> list[dict]:
    return [{"title": "Mathematics · Fractions Notes", "type": "PDF", "class_section": "5A"}, {"title": "Plant life video lesson", "type": "Video", "class_section": "4A"}]


@router.get("/timetable")
def timetable(_: dict = TeacherUser) -> list[dict]:
    return [{"time": "08:15", "subject": "Mathematics", "class_section": "5A", "room": "Room 204"}, {"time": "09:10", "subject": "Mathematics", "class_section": "5B", "room": "Room 204"}, {"time": "10:30", "subject": "Science", "class_section": "4A", "room": "Lab 02"}]


@router.get("/messages")
def messages(_: dict = TeacherUser) -> list[dict]:
    return [{"parent": "Mrs. Sharma", "student": "Aarav Sharma", "preview": "Thank you for the progress update.", "time": "10:32 AM"}, {"parent": "Mr. Gupta", "student": "Saanvi Gupta", "preview": "Could we schedule a quick meeting?", "time": "Yesterday"}]


@router.get("/announcements")
def announcements(_: dict = TeacherUser) -> list[dict]:
    return [{"title": "Mathematics revision worksheet", "audience": "Class 5A", "sent_on": "2027-06-11"}, {"title": "Science project materials", "audience": "Class 4A", "sent_on": "2027-06-10"}]


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
