from typing import Literal

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
    role: Literal["parent", "teacher", "admin"]


class CognitoTokenExchangeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    code_verifier: str = Field(min_length=43, max_length=128)


class AdmissionDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected", "needs_information"]
    class_section: str | None = Field(default=None, max_length=30)


class CreateApplicationRequest(BaseModel):
    student_name: str = Field(min_length=2, max_length=120)
    desired_class: str = Field(min_length=2, max_length=40)


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
