from typing import Any, Literal

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    phone: str = Field(min_length=8, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    role: Literal["parent", "teacher", "student", "admin", "admission"]


class CognitoTokenExchangeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    code_verifier: str = Field(min_length=43, max_length=128)


class AdmissionDecisionRequest(BaseModel):
    decision: Literal["approved", "approve_with_exception", "rejected", "needs_information", "remark"]
    class_section: str | None = Field(default=None, max_length=30)
    section_allocation: str | None = Field(default=None, max_length=30)
    admin_remark: str = Field(default="", max_length=1000)


class DocumentReviewRequest(BaseModel):
    decision: Literal["under_verification", "verified", "reupload_required", "rejected"]
    reason: str = Field(default="", max_length=500)


class CreateApplicationRequest(BaseModel):
    student_name: str = Field(min_length=2, max_length=120)
    desired_class: str = Field(min_length=2, max_length=40)


class SaveApplicationDraftRequest(BaseModel):
    application_number: str = Field(min_length=5, max_length=60)
    data: dict[str, Any] = Field(default_factory=dict)
    documents: list[dict[str, Any]] = Field(default_factory=list)
    status: Literal["draft", "submitted"] = "draft"


class RegistrationFeePaymentRequest(BaseModel):
    method: str = Field(min_length=2, max_length=80)


class ParentalConsentRequest(BaseModel):
    parent_name: str = Field(min_length=2, max_length=120)
    relationship_to_child: str = Field(min_length=2, max_length=80)
    parent_mobile: str = Field(min_length=8, max_length=20)
    parent_email: str = Field(min_length=5, max_length=254)
    child_name: str = Field(min_length=2, max_length=120)
    child_dob: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class ParentalConsentWithdrawalRequest(BaseModel):
    parent_mobile: str = Field(min_length=8, max_length=20)
    otp: str = Field(pattern=r"^\d{6}$")


class CreateUserRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    role: Literal["parent", "teacher", "student", "admin", "admission"]
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserRoleUpdate(BaseModel):
    role: Literal["parent", "teacher", "student", "admin", "admission"]
    full_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254)


class AttendanceRecord(BaseModel):
    student_name: str = Field(min_length=2, max_length=120)
    status: Literal["Present", "Late", "Absent"]


class AttendanceRequest(BaseModel):
    class_section: str = Field(min_length=2, max_length=20)
    date: str = Field(min_length=10, max_length=10)
    records: list[AttendanceRecord] = Field(min_length=1)


class AssignmentRequest(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    class_section: str = Field(min_length=2, max_length=20)
    due_date: str = Field(min_length=10, max_length=10)
    instructions: str = Field(default="", max_length=3000)


class AnnouncementRequest(BaseModel):
    audience: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=3, max_length=3000)
    channels: list[Literal["app", "email", "sms"]] = Field(default=["app"])


class AIRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=3000)
    audience: Literal["guest", "parent", "teacher", "admin"] = "guest"


class OTPRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=20)


class OTPVerifyRequest(OTPRequest):
    otp: str = Field(pattern=r"^\d{6}$")


class EmailOTPRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class EmailOTPVerifyRequest(EmailOTPRequest):
    otp: str = Field(pattern=r"^\d{6}$")
