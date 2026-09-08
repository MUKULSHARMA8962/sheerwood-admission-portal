"""Best-effort email notifications for admission workflow events."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

from .database import connection

logger = logging.getLogger(__name__)


def _valid_email(address: str | None) -> str:
    value = str(address or "").strip().lower()
    if "\r" in value or "\n" in value or value.count("@") != 1:
        return ""
    local_part, _, domain = value.partition("@")
    return value if local_part and "." in domain else ""


def _additional_admin_emails() -> set[str]:
    configured = os.getenv("ADMISSION_NOTIFICATION_EMAILS", "")
    return {email for value in configured.split(",") if (email := _valid_email(value))}


def _admin_recipients() -> set[str]:
    with connection() as database:
        rows = database.execute("SELECT email FROM users WHERE role = 'admin'").fetchall()
    return {email for row in rows if (email := _valid_email(row["email"]))} | _additional_admin_emails()


def _send_messages(messages: list[tuple[str, str, str]]) -> None:
    """Send individual messages so administrator addresses are never exposed."""
    host = os.getenv("SMTP_HOST", "").strip()
    sender = _valid_email(os.getenv("SMTP_FROM_EMAIL"))
    if not host or not sender:
        logger.warning("Admission email notifications skipped because SMTP is not configured.")
        return

    try:
        port = int(os.getenv("SMTP_PORT", "587"))
        username = os.getenv("SMTP_USERNAME", "").strip()
        password = os.getenv("SMTP_PASSWORD", "")
        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            if use_tls:
                smtp.starttls(context=ssl.create_default_context())
            if username:
                if not password:
                    logger.warning("Admission email notifications skipped because SMTP_PASSWORD is missing.")
                    return
                smtp.login(username, password)
            for recipient, subject, body in messages:
                message = EmailMessage()
                message["Subject"] = subject
                message["From"] = sender
                message["To"] = recipient
                message.set_content(body)
                smtp.send_message(message)
    except Exception:
        # A notification must never make a successfully saved application fail.
        logger.exception("Admission email notification could not be delivered.")


def send_admission_submission_notifications(
    *,
    parent_email: str,
    parent_name: str,
    student_name: str,
    application_number: str,
    desired_class: str,
) -> None:
    """Notify the applicant and every configured admin after first submission."""
    parent_recipient = _valid_email(parent_email)
    parent_display_name = parent_name.strip() or "Parent"
    student_display_name = student_name.strip() or "Applicant"
    application_display = application_number.strip()
    class_display = desired_class.strip() or "selected class"
    messages: list[tuple[str, str, str]] = []

    if parent_recipient:
        messages.append((
            parent_recipient,
            f"Sheerwood admission application received — {application_display}",
            "\n".join([
                f"Dear {parent_display_name},",
                "",
                f"Your admission application for {student_display_name} has been received.",
                f"Application ID: {application_display}",
                f"Class applying for: {class_display}",
                "",
                "Please sign in to the Admission Dashboard to upload documents and track verification and approval.",
                "",
                "Sheerwood International School Admissions",
            ]),
        ))

    for admin_email in _admin_recipients():
        messages.append((
            admin_email,
            f"New admission application — {application_display}",
            "\n".join([
                "A new admission application has been submitted.",
                "",
                f"Student: {student_display_name}",
                f"Application ID: {application_display}",
                f"Class applying for: {class_display}",
                "",
                "Open the Admin Admissions dashboard to review documents and update the application.",
            ]),
        ))

    if messages:
        _send_messages(messages)
