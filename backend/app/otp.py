"""Secure, short-lived OTP generation and AWS SNS delivery."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

import boto3

from .database import connection

OTP_EXPIRY_SECONDS = max(60, int(os.getenv("OTP_EXPIRY_SECONDS", "300")))
OTP_RESEND_SECONDS = max(30, int(os.getenv("OTP_RESEND_SECONDS", "60")))
OTP_MAX_ATTEMPTS = max(1, int(os.getenv("OTP_MAX_ATTEMPTS", "5")))


class OTPConfigurationError(Exception):
    """Raised when a required server-side OTP setting is missing."""


class OTPDeliveryError(Exception):
    """Raised when AWS SNS cannot deliver an OTP."""


class OTPResendTooSoonError(Exception):
    """Raised when an OTP was requested again before the cooldown expired."""


def normalize_phone_number(phone_number: str) -> str:
    """Return a strict E.164 number; SMS providers require the country code."""
    normalized = "".join(character for character in phone_number.strip() if character.isdigit() or character == "+")
    if not normalized.startswith("+") or not normalized[1:].isdigit() or not 8 <= len(normalized[1:]) <= 15:
        raise ValueError("Use a valid mobile number with country code, for example +919876543210.")
    return normalized


def _otp_secret() -> str:
    secret = os.getenv("OTP_SECRET_KEY")
    if not secret:
        raise OTPConfigurationError("OTP_SECRET_KEY is not configured on the server.")
    return secret


def _hash_otp(phone_number: str, otp: str) -> str:
    return hmac.new(_otp_secret().encode(), f"{phone_number}:{otp}".encode(), hashlib.sha256).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def send_otp(phone_number: str, otp: str) -> None:
    """Send an OTP using AWS SNS without logging the code or phone number."""
    try:
        sns = boto3.client("sns", region_name=os.getenv("AWS_REGION", "us-east-1"))
        sns.publish(
            PhoneNumber=phone_number,
            Message=f"Your Sheerwood login OTP is {otp}. It is valid for 5 minutes. Do not share this code.",
            MessageAttributes={
                "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
            },
        )
    except Exception as error:
        raise OTPDeliveryError("Unable to send the OTP right now. Please try again shortly.") from error


def issue_otp(phone_number: str) -> int:
    """Create, hash, store and send a new OTP. Returns only its expiry duration."""
    normalized_phone = normalize_phone_number(phone_number)
    now = _now()

    with connection() as database:
        previous = database.execute("SELECT created_at FROM otp_codes WHERE phone_number = ?", (normalized_phone,)).fetchone()
        if previous:
            last_request = datetime.fromisoformat(previous["created_at"])
            remaining = OTP_RESEND_SECONDS - int((now - last_request).total_seconds())
            if remaining > 0:
                raise OTPResendTooSoonError(f"Please wait {remaining} seconds before requesting another OTP.")

    otp = str(secrets.randbelow(900_000) + 100_000)
    code_hash = _hash_otp(normalized_phone, otp)
    send_otp(normalized_phone, otp)

    with connection() as database:
        database.execute(
            """INSERT INTO otp_codes (phone_number, code_hash, created_at, expires_at, attempts)
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(phone_number) DO UPDATE SET
                code_hash = excluded.code_hash,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at,
                attempts = 0""",
            (normalized_phone, code_hash, now.isoformat(), (now + timedelta(seconds=OTP_EXPIRY_SECONDS)).isoformat()),
        )
    return OTP_EXPIRY_SECONDS


def verify_otp(phone_number: str, otp: str) -> bool:
    """Verify one OTP once. Expired, used and over-attempted codes are deleted."""
    normalized_phone = normalize_phone_number(phone_number)
    with connection() as database:
        record = database.execute("SELECT * FROM otp_codes WHERE phone_number = ?", (normalized_phone,)).fetchone()
        if not record:
            return False

        if datetime.fromisoformat(record["expires_at"]) <= _now() or record["attempts"] >= OTP_MAX_ATTEMPTS:
            database.execute("DELETE FROM otp_codes WHERE phone_number = ?", (normalized_phone,))
            return False

        is_valid = hmac.compare_digest(record["code_hash"], _hash_otp(normalized_phone, otp))
        if is_valid:
            database.execute("DELETE FROM otp_codes WHERE phone_number = ?", (normalized_phone,))
            return True

        database.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone_number = ?", (normalized_phone,))
        return False
