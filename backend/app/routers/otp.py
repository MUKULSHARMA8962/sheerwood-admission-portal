"""Public, rate-limited endpoints for email and mobile OTP verification."""

from __future__ import annotations

import os
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, status

from ..otp import OTPConfigurationError, OTPDeliveryError, OTPResendTooSoonError, issue_email_otp, issue_otp, verify_email_otp, verify_otp
from ..schemas import EmailOTPRequest, EmailOTPVerifyRequest, OTPRequest, OTPVerifyRequest

router = APIRouter(prefix="/api/auth/otp", tags=["Mobile OTP"])

_request_history: dict[str, deque[float]] = defaultdict(deque)
_history_lock = Lock()


def _check_rate_limit(client_id: str) -> None:
    request_limit = max(1, int(os.getenv("OTP_RATE_LIMIT_REQUESTS", "3")))
    window_seconds = max(60, int(os.getenv("OTP_RATE_LIMIT_WINDOW_SECONDS", "3600")))
    now = monotonic()
    with _history_lock:
        timestamps = _request_history[client_id]
        while timestamps and now - timestamps[0] >= window_seconds:
            timestamps.popleft()
        if len(timestamps) >= request_limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests. Please try again later.")
        timestamps.append(now)


@router.post("/request", status_code=status.HTTP_202_ACCEPTED)
def request_otp(payload: OTPRequest, request: Request) -> dict[str, int | str]:
    client_id = request.client.host if request.client else "unknown"
    _check_rate_limit(client_id)
    try:
        expires_in = issue_otp(payload.phone_number)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except OTPResendTooSoonError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)) from error
    except OTPConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OTP service is not configured yet.") from error
    except OTPDeliveryError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return {"message": "OTP sent successfully.", "expires_in": expires_in}


@router.post("/verify")
def verify_mobile_otp(payload: OTPVerifyRequest) -> dict[str, str]:
    try:
        is_valid = verify_otp(payload.phone_number, payload.otp)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except OTPConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OTP service is not configured yet.") from error

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is invalid, expired or has already been used.")
    return {"message": "Mobile number verified successfully."}


@router.post("/email/request", status_code=status.HTTP_202_ACCEPTED, tags=["Email OTP"])
def request_email_otp(payload: EmailOTPRequest, request: Request) -> dict[str, int | str]:
    client_id = request.client.host if request.client else "unknown"
    _check_rate_limit(client_id)
    try:
        expires_in = issue_email_otp(payload.email)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except OTPResendTooSoonError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)) from error
    except OTPConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email OTP service is not configured yet.") from error
    except OTPDeliveryError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return {"message": "Email OTP sent successfully.", "expires_in": expires_in}


@router.post("/email/verify", tags=["Email OTP"])
def verify_email(payload: EmailOTPVerifyRequest) -> dict[str, str]:
    try:
        is_valid = verify_email_otp(payload.email, payload.otp)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except OTPConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email OTP service is not configured yet.") from error

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is invalid, expired or has already been used.")
    return {"message": "Email address verified successfully."}
