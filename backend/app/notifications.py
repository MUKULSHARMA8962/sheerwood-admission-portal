"""Best-effort email notifications for admission workflow events."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from .database import connection
from .email_service import configured_sender, send_email

logger = logging.getLogger(__name__)


FORM_SECTION_LABELS = {
    "admissionDetails": "Admission Details",
    "student": "Student Details",
    "guardians": "Parent / Guardian Details",
}
FORM_FIELD_LABELS = {
    "aadhaar": "Aadhaar Number",
    "adhd": "Attention Deficit Hyperactive Disorder (ADHD)",
    "birthDate": "Date of Birth",
    "currentClass": "Current Class",
    "fullName": "Full Name",
    "howHeard": "How did you hear about the school?",
    "penNumber": "PEN Number",
    "placeOfBirth": "Place of Birth",
    "previousSchool": "Previous School",
    "responsibleParent": "Responsible Parent",
    "sld": "Specific Learning Disability (SLD)",
}
FORM_METADATA_FIELDS = {"otpVerification", "storageId", "contentType", "sizeBytes", "uploadedDocuments"}


def _form_label(value: str) -> str:
    if value in FORM_FIELD_LABELS:
        return FORM_FIELD_LABELS[value]
    readable = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", str(value or ""))
    return readable.replace("_", " ").replace("-", " ").strip().title()


def _form_value(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        return ", ".join(_form_value(item) for item in value if _form_value(item))
    return str(value or "").replace("\r", " ").replace("\n", " ").strip()


def _append_form_entries(lines: list[str], values: dict[str, Any], indent: str = "") -> None:
    for key, value in values.items():
        if key in FORM_METADATA_FIELDS or value in (None, "", [], {}):
            continue
        if isinstance(value, dict):
            child_entries: list[str] = []
            _append_form_entries(child_entries, value, f"{indent}  ")
            if child_entries:
                lines.append(f"{indent}{_form_label(key)}:")
                lines.extend(child_entries)
            continue
        if key == "file":
            continue
        display_value = _form_value(value)
        if display_value:
            lines.append(f"{indent}{_form_label(key)}: {display_value}")


def _completed_application_form(application_data: dict[str, Any] | None, documents: list[dict[str, Any]] | None) -> list[str]:
    """Render the saved form as a readable plain-text email section."""
    data = application_data if isinstance(application_data, dict) else {}
    lines: list[str] = []
    rendered_keys: set[str] = set()

    for key, heading in FORM_SECTION_LABELS.items():
        values = data.get(key)
        if not isinstance(values, dict):
            continue
        section_lines: list[str] = []
        _append_form_entries(section_lines, values)
        if section_lines:
            lines.extend([heading, *section_lines, ""])
            rendered_keys.add(key)

    section_field_keys = {
        field for key in rendered_keys
        for field in data.get(key, {})
        if isinstance(data.get(key), dict)
    }
    remaining_values = {
        key: value for key, value in data.items()
        if key not in rendered_keys | section_field_keys | FORM_METADATA_FIELDS | {"studentPhoto", "parentPhotos"}
    }
    remaining_lines: list[str] = []
    _append_form_entries(remaining_lines, remaining_values)
    if remaining_lines:
        lines.extend(["Additional Application Details", *remaining_lines, ""])

    listed_documents = [document for document in documents or [] if isinstance(document, dict) and (document.get("file") or document.get("file_name"))]
    if listed_documents:
        lines.append("Documents")
        for document in listed_documents:
            name = _form_value(document.get("name") or document.get("id") or "Document")
            file_name = _form_value(document.get("file") or document.get("file_name"))
            document_status = _form_value(document.get("status") or "Uploaded")
            lines.append(f"{name}: {file_name} ({document_status})")
        lines.append("")

    return [line for line in lines if line is not None]


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
    if not _valid_email(configured_sender()):
        logger.warning("Admission email notifications skipped because no sender email is configured.")
        return

    try:
        for recipient, subject, body in messages:
            send_email(recipient=recipient, subject=subject, body=body)
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
    application_data: dict[str, Any] | None = None,
    documents: list[dict[str, Any]] | None = None,
) -> None:
    """Notify the applicant and every configured admin after first submission."""
    parent_recipient = _valid_email(parent_email)
    parent_display_name = parent_name.strip() or "Parent"
    student_display_name = student_name.strip() or "Applicant"
    application_display = application_number.strip()
    class_display = desired_class.strip() or "selected class"
    completed_form = _completed_application_form(application_data, documents)
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
                "COMPLETED APPLICATION FORM",
                *completed_form,
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
                "COMPLETED APPLICATION FORM",
                *completed_form,
                "Open the Admin Admissions dashboard to review documents and update the application.",
            ]),
        ))

    if messages:
        _send_messages(messages)
