"""Secure, short-lived OTP generation and AWS SNS delivery."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

import boto3

from .database import connection
from .email_service import send_email

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


def normalize_email_address(email: str) -> str:
    """Return a normalized email address suitable for OTP storage and delivery."""
    normalized = email.strip().lower()
    local_part, separator, domain = normalized.partition("@")
    if not separator or not local_part or not domain or "." not in domain or len(normalized) > 254:
        raise ValueError("Enter a valid email address.")
    return normalized


def _otp_secret() -> str:
    secret = os.getenv("OTP_SECRET_KEY")
    if not secret:
        raise OTPConfigurationError("OTP_SECRET_KEY is not configured on the server.")
    return secret


def _hash_otp(recipient: str, otp: str) -> str:
    return hmac.new(_otp_secret().encode(), f"{recipient}:{otp}".encode(), hashlib.sha256).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def send_otp(phone_number: str, otp: str) -> None:
    """Send an OTP using AWS SNS without logging the code or phone number."""
    try:
        sns = boto3.client("sns", region_name=os.getenv("AWS_REGION", "us-east-1"))
        sns.publish(
            PhoneNumber=phone_number,
            Message=f"Your Sherwood College login OTP is {otp}. It is valid for 5 minutes. Do not share this code.",
            MessageAttributes={
                "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
            },
        )
    except Exception as error:
        raise OTPDeliveryError("Unable to send the OTP right now. Please try again shortly.") from error


def send_email_otp(email: str, otp: str) -> None:
    """Deliver an OTP through AWS SES without logging the email address or code."""
    try:
        send_email(
            recipient=email,
            subject="Your Sherwood College verification code",
            body=f"Your Sherwood College verification code is {otp}. It is valid for 5 minutes. Do not share this code.",
        )
    except Exception as error:
        raise OTPDeliveryError("Unable to send the email OTP right now. Please try again shortly.") from error


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


def issue_email_otp(email: str) -> int:
    """Create, hash, store and email a one-time password."""
    normalized_email = normalize_email_address(email)
    now = _now()

    with connection() as database:
        previous = database.execute("SELECT created_at FROM email_otp_codes WHERE email = ?", (normalized_email,)).fetchone()
        if previous:
            last_request = datetime.fromisoformat(previous["created_at"])
            remaining = OTP_RESEND_SECONDS - int((now - last_request).total_seconds())
            if remaining > 0:
                raise OTPResendTooSoonError(f"Please wait {remaining} seconds before requesting another OTP.")

    otp = str(secrets.randbelow(900_000) + 100_000)
    send_email_otp(normalized_email, otp)
    code_hash = _hash_otp(normalized_email, otp)

    with connection() as database:
        database.execute(
            """INSERT INTO email_otp_codes (email, code_hash, created_at, expires_at, attempts)
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(email) DO UPDATE SET
                code_hash = excluded.code_hash,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at,
                attempts = 0""",
            (normalized_email, code_hash, now.isoformat(), (now + timedelta(seconds=OTP_EXPIRY_SECONDS)).isoformat()),
        )
    return OTP_EXPIRY_SECONDS


def verify_email_otp(email: str, otp: str) -> bool:
    """Verify one email OTP once; reject expired or over-attempted codes."""
    normalized_email = normalize_email_address(email)
    with connection() as database:
        record = database.execute("SELECT * FROM email_otp_codes WHERE email = ?", (normalized_email,)).fetchone()
        if not record:
            return False

        if datetime.fromisoformat(record["expires_at"]) <= _now() or record["attempts"] >= OTP_MAX_ATTEMPTS:
            database.execute("DELETE FROM email_otp_codes WHERE email = ?", (normalized_email,))
            return False

        is_valid = hmac.compare_digest(record["code_hash"], _hash_otp(normalized_email, otp))
        if is_valid:
            database.execute("DELETE FROM email_otp_codes WHERE email = ?", (normalized_email,))
            return True

        database.execute("UPDATE email_otp_codes SET attempts = attempts + 1 WHERE email = ?", (normalized_email,))
        return False
