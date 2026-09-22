"""Best-effort email notifications for admission workflow events."""

from __future__ import annotations

import logging
import os
import re
from textwrap import wrap
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


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _application_pdf(*, application_number: str, student_name: str, desired_class: str, form_lines: list[str]) -> bytes:
    """Create a small dependency-free PDF receipt from the completed form."""
    lines = [
        "Sheerwood College",
        "Admission Application Form",
        f"Application ID: {application_number}",
        f"Student: {student_name}",
        f"Class: {desired_class}",
        "",
        *form_lines,
    ]
    wrapped_lines = [part for line in lines for part in (wrap(str(line), 92) or [""])]
    pages = [wrapped_lines[index:index + 48] for index in range(0, len(wrapped_lines), 48)] or [[]]
    objects: list[bytes] = []
    page_ids: list[int] = []
    font_id = 3
    next_id = 4
    for page_lines in pages:
        commands = ["BT", "/F1 10 Tf", "50 760 Td"]
        for index, line in enumerate(page_lines):
            if index:
                commands.append("0 -15 Td")
            commands.append(f"({_pdf_escape(line)}) Tj")
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", "replace")
        content_id = next_id
        page_id = next_id + 1
        next_id += 2
        objects.extend([f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream", b""])
        page_ids.append(page_id)
        objects[-1] = f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>".encode()
    objects[0:0] = [b"<< /Type /Catalog /Pages 2 0 R >>", f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] /Count {len(page_ids)} >>".encode(), b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for object_id, content in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode() + content + b"\nendobj\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    pdf.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode())
    return bytes(pdf)


def _syllabus_pdf(*, application_number: str, student_name: str, syllabus: list[dict[str, Any]]) -> bytes:
    lines = [
        "Sheerwood College",
        "Entrance Test Syllabus",
        f"Application ID: {application_number}",
        f"Student: {student_name}",
        "",
        "SYLLABUS",
    ]
    for item in syllabus:
        lines.extend([f"{item['subject']}", f"  {item['details']}", ""])
    return _application_pdf(application_number=application_number, student_name=student_name, desired_class="Entrance Test", form_lines=lines[5:])


def _send_messages(messages: list[tuple[str, str, str, list[tuple[str, bytes, str]]]]) -> None:
    """Send individual messages so administrator addresses are never exposed."""
    if not _valid_email(configured_sender()):
        logger.warning("Admission email notifications skipped because no sender email is configured.")
        return

    try:
        for recipient, subject, body, attachments in messages:
            send_email(recipient=recipient, subject=subject, body=body, attachments=attachments)
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
    pdf_attachment = [(f"{application_display.replace('/', '-')}-application.pdf", _application_pdf(application_number=application_display, student_name=student_display_name, desired_class=class_display, form_lines=completed_form), "application/pdf")]
    messages: list[tuple[str, str, str, list[tuple[str, bytes, str]]]] = []

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
            pdf_attachment,
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
            pdf_attachment,
        ))

    if messages:
        _send_messages(messages)


def send_admission_approval_notification(*, parent_email: str, parent_name: str, student_name: str, application_number: str) -> None:
    """Send the acceptance letter and current entrance-test syllabus."""
    recipient = _valid_email(parent_email)
    if not recipient:
        return
    with connection() as database:
        rows = database.execute("SELECT subject, details FROM entrance_syllabus WHERE active = 1 ORDER BY sort_order, id").fetchall()
    syllabus = [dict(row) for row in rows]
    syllabus_lines = ["ENTRANCE TEST SYLLABUS", ""]
    syllabus_lines.extend(f"{item['subject']}: {item['details']}" for item in syllabus)
    if not syllabus:
        syllabus_lines.append("The entrance-test syllabus will be shared by the admissions office.")
    display_name = parent_name.strip() or "Parent"
    display_student = student_name.strip() or "the applicant"
    body = "\n".join([
        f"Dear {display_name},", "",
        "ADMISSION ACCEPTED", "",
        f"We are pleased to inform you that {display_student}'s admission application has been accepted by Sheerwood College.",
        "", f"Application ID: {application_number}", "", *syllabus_lines, "",
        "Please keep the attached syllabus for the entrance-test preparation.",
        "For further instructions, sign in to the parent admission portal or contact the admissions office.",
        "", "Regards,", "Admissions Office", "Sheerwood College",
    ])
    attachment = [(f"{application_number.replace('/', '-')}-entrance-syllabus.pdf", _syllabus_pdf(application_number=application_number, student_name=display_student, syllabus=syllabus), "application/pdf")]
    _send_messages([(recipient, f"Admission accepted — {application_number}", body, attachment)])
