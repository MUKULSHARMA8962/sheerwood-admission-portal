import os
import logging

from fastapi import APIRouter, Depends, HTTPException, status
import boto3
from botocore.exceptions import BotoCoreError, ClientError

from ..ai import AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError, generate_ai_reply
from ..database import connection
from ..dependencies import require_roles
from ..schemas import AIRequest, AnnouncementRequest, UserRoleUpdate

router = APIRouter(prefix="/api/admin", tags=["Admin UI"])
AdminUser = Depends(require_roles("admin"))
logger = logging.getLogger(__name__)


def cognito_admin_client():
    issuer = os.getenv("COGNITO_ISSUER", "").rstrip("/")
    user_pool_id = issuer.rsplit("/", 1)[-1]
    region = os.getenv("AWS_REGION", "us-east-1")
    if not user_pool_id:
        raise HTTPException(status_code=503, detail="Cognito user pool is not configured.")
    return boto3.client("cognito-idp", region_name=region), user_pool_id


@router.get("/dashboard")
def dashboard(_: dict = AdminUser) -> dict:
    return {"summary": {"students": 1248, "teachers": 74, "new_applications": 126, "pending_approvals": 38, "fees_collected": 840000, "attendance": 93.6}, "priority_tasks": [{"title": "Admission approvals pending", "count": 38}, {"title": "Documents awaiting verification", "count": 12}, {"title": "Fee payment follow-ups", "count": 6}]}


@router.get("/admissions")
def admissions(_: dict = AdminUser) -> list[dict]:
    with connection() as database:
        rows = database.execute("SELECT * FROM applications ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


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
    return [{"student": "Aadhya Sharma", "document": "Birth Certificate", "status": "verified"}, {"student": "Vivaan Singh", "document": "Transfer Certificate", "status": "pending"}, {"student": "Ananya Gupta", "document": "Previous Report Card", "status": "needs_review"}]


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
            role = next((candidate for candidate in ("admin", "teacher", "student", "parent", "admission") if candidate in group_names), "admission")
            result.append({"id": f"cognito:{cognito_user['Username']}", "email": attributes.get("email", ""), "full_name": attributes.get("name") or attributes.get("email", cognito_user["Username"]), "role": role, "cognito_subject": attributes.get("sub"), "groups": group_names, "status": cognito_user.get("UserStatus", "")})
        return result
    except (BotoCoreError, ClientError) as error:
        error_code = error.response.get("Error", {}).get("Code", "AWS credentials or permissions error") if isinstance(error, ClientError) else str(error)
        logger.exception("Cognito user listing failed: %s", error_code)
        raise HTTPException(status_code=503, detail=f"Cognito users could not be loaded: {error_code}") from error


@router.patch("/users-roles/{user_id}")
def update_user_role(user_id: str, payload: UserRoleUpdate, _: dict = AdminUser) -> dict:
    if user_id.startswith("cognito:"):
        client, user_pool_id = cognito_admin_client()
        username = user_id.removeprefix("cognito:")
        try:
            groups = client.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=username).get("Groups", [])
            for group in ("admin", "teacher", "student", "parent", "admission"):
                if any(item["GroupName"] == group for item in groups) and group != payload.role:
                    client.admin_remove_user_from_group(UserPoolId=user_pool_id, Username=username, GroupName=group)
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


@router.get("/settings")
def settings(_: dict = AdminUser) -> dict:
    return {"school_name": "Sheerwood International School", "academic_session": "2027–28", "branches": 1, "classes": "2–12", "subjects": 42, "notification_channels": ["app", "email", "sms"]}


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
