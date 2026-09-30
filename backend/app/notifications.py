"""Best-effort email notifications for admission workflow events."""

from __future__ import annotations

import logging
import os
import re
from html import escape
from textwrap import wrap
from typing import Any

from .admission_pptx import build_admission_pptx
from .database import connection
from .email_service import configured_sender, send_email

logger = logging.getLogger(__name__)


FORM_SECTION_LABELS = {
    "admissionDetails": "Admission Details",
    "student": "Student Details",
    "addresses": "Address Details",
    "guardians": "Parent / Guardian Details",
}
FORM_SECTION_FIELDS = {
    "admissionDetails": ("session", "date", "class", "stream", "penNumber", "previousSchool", "currentClass", "board", "boardOther", "medium"),
    "student": ("firstName", "middleName", "lastName", "birthDate", "placeOfBirth", "gender", "bloodGroup", "motherTongue", "nationality", "nationalityOther", "nationalityCountryId", "religion", "religionOther", "category", "sld", "adhd", "singleParent", "responsibleParent", "howHeard", "howHeardOther", "aadhaar"),
    "addresses": ("communication", "permanent"),
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
    "session": "Academic Year",
    "sld": "Specific Learning Disability (SLD)",
    "communication": "Address for Communication",
    "permanent": "Permanent Address",
}
FORM_METADATA_FIELDS = {"otpVerification", "storageId", "contentType", "sizeBytes", "uploadedDocuments"}


def _form_label(value: str) -> str:
    if value in FORM_FIELD_LABELS:
        return FORM_FIELD_LABELS[value]
    readable = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", str(value or ""))
    return readable.replace("_", " ").replace("-", " ").strip().title()


def _form_value(value: Any, field_name: str = "") -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        return ", ".join(part for item in value if (part := _form_value(item, field_name)))
    text = str(value if value is not None else "").replace("\r", " ").replace("\n", " ").strip()
    if field_name == "birthDate" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        year, month, day = text.split("-")
        return f"{day}-{month}-{year}"
    return text


def _append_form_entries(lines: list[str], values: dict[str, Any], indent: str = "") -> None:
    for key, value in values.items():
        if key in FORM_METADATA_FIELDS:
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
        lines.append(f"{indent}{_form_label(key)}: {_form_value(value, key) or 'Not provided'}")


def _completed_application_form(application_data: dict[str, Any] | None, documents: list[dict[str, Any]] | None) -> list[str]:
    """Render the saved form as a readable plain-text email section."""
    data = application_data if isinstance(application_data, dict) else {}
    lines: list[str] = []
    rendered_keys: set[str] = set()

    for key, heading in FORM_SECTION_LABELS.items():
        values = data.get(key)
        if key == "guardians" and not isinstance(values, dict):
            continue
        if key in FORM_SECTION_FIELDS:
            source = values if isinstance(values, dict) else {}
            values = {field: source.get(field, data.get(field)) for field in FORM_SECTION_FIELDS[key]}
            values.update({field: value for field, value in source.items() if field not in values})
        section_lines: list[str] = []
        _append_form_entries(section_lines, values)
        if section_lines:
            lines.extend([heading, *section_lines, ""])
            rendered_keys.add(key)

    section_field_keys = {field for fields in FORM_SECTION_FIELDS.values() for field in fields} | {
        field for key in rendered_keys
        for field in (data.get(key) or {})
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

    student_photo = data.get("studentPhoto")
    student_photo_file = student_photo.get("file") if isinstance(student_photo, dict) else None
    photo_lines = [f"Student Photograph: {_form_value(student_photo_file) or 'Not uploaded'}"]
    parent_photos = data.get("parentPhotos") if isinstance(data.get("parentPhotos"), dict) else {}
    for parent in ("Father", "Mother"):
        photo = parent_photos.get(parent) or parent_photos.get(parent.lower())
        file_name = photo.get("file") if isinstance(photo, dict) else None
        photo_lines.append(f"{parent} Photograph: {_form_value(file_name) or 'Not uploaded'}")
    for parent, photo in parent_photos.items():
        if str(parent).lower() in {"father", "mother"} or not isinstance(photo, dict):
            continue
        photo_lines.append(f"{_form_label(parent)} Photograph: {_form_value(photo.get('file')) or 'Not uploaded'}")
    lines.extend(["Photographs", *photo_lines, ""])

    listed_documents = [document for document in documents or [] if isinstance(document, dict)]
    if listed_documents:
        lines.append("Documents")
        for document in listed_documents:
            name = _form_value(document.get("name") or document.get("id") or "Document")
            file_name = _form_value(document.get("file") or document.get("file_name")) or "Not uploaded"
            document_status = _form_value(document.get("status") or ("Uploaded" if file_name != "Not uploaded" else "Not uploaded"))
            lines.append(f"{name}: {file_name} ({document_status})")
        lines.append("")

    return [line for line in lines if line is not None]


def _application_html(*, title: str, student_name: str, application_number: str, desired_class: str, form_lines: list[str], closing: str) -> str:
    """Render the same form fields in the portal's cyan-and-white email style."""
    parts = [
        '<div style="margin:0;padding:28px 14px;background:#12c9e8;font-family:Arial,sans-serif;color:#073c49;line-height:1.5">',
        '<div style="max-width:720px;margin:0 auto;overflow:hidden;border-radius:26px;background:#ffffff;box-shadow:0 10px 28px rgba(1,68,83,.22)">',
        '<div style="padding:30px 30px 24px;text-align:center;background:#ffffff">',
        '<div style="display:inline-block;color:#0a90b0;font-size:25px;font-weight:800;letter-spacing:-1px">Sherwood</div>',
        '<div style="margin-top:1px;color:#0c5162;font-size:9px;font-weight:800;letter-spacing:2px">COLLEGE</div>',
        '<div style="width:54px;height:4px;margin:17px auto 15px;border-radius:999px;background:#f5be3f"></div>',
        f'<h1 style="margin:0;color:#073c49;font-family:Georgia,serif;font-size:27px;font-weight:600;line-height:1.2">{escape(title)}</h1>',
        f'<p style="margin:14px 0 0;color:#397080;font-size:14px">Application ID: <strong style="color:#073c49">{escape(application_number)}</strong><br>'
        f'Student: {escape(student_name)} &nbsp;•&nbsp; Class applying for: {escape(desired_class)}</p>',
        '</div>',
        '<div style="height:7px;background:#064b5b"></div>',
        '<div style="padding:26px 30px 8px;background:#ffffff">',
    ]
    table_open = False
    for line in form_lines:
        if not line.strip():
            if table_open:
                parts.append("</tbody></table>")
                table_open = False
            continue
        if ":" not in line or line.rstrip().endswith(":"):
            if table_open:
                parts.append("</tbody></table>")
                table_open = False
            parts.append(f'<h2 style="margin:22px 0 9px;padding:10px 13px;border-radius:8px;color:#ffffff;background:#064b5b;font-size:14px;letter-spacing:.3px">{escape(line.strip().rstrip(":"))}</h2>')
            continue
        if not table_open:
            parts.append('<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;font-size:13px"><tbody>')
            table_open = True
        label, value = line.strip().split(":", 1)
        parts.append(
            '<tr>'
            f'<th style="text-align:left;vertical-align:top;width:38%;padding:9px 11px;border:1px solid #cdeef4;color:#07586b;background:#effbfe;font-size:12px">{escape(label)}</th>'
            f'<td style="vertical-align:top;padding:9px 11px;border:1px solid #cdeef4;color:#164955;background:#ffffff">{escape(value.strip())}</td>'
            '</tr>'
        )
    if table_open:
        parts.append("</tbody></table>")
    parts.extend([
        '</div>',
        '<div style="padding:20px 30px 28px;background:#f1fcff">',
        f'<p style="margin:0;color:#1f5d6c;font-size:13px;line-height:1.65">{escape(closing)}</p>',
        '<p style="margin:16px 0 0;color:#4e7b86;font-size:11px">Sherwood College Admissions</p>',
        '</div>',
        '</div>',
        '<p style="max-width:720px;margin:15px auto 0;color:#e9fdff;font-size:10px;text-align:center">This is an automated message from the Sherwood College Admissions Portal.</p>',
        '</div>',
    ])
    return "".join(parts)


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
        "Sherwood College",
        "Admission Application Form",
        f"Application ID: {application_number}",
        f"Student: {student_name}",
        f"Class: {desired_class}",
        "",
        *form_lines,
    ]
    wrapped_lines = [part for line in lines for part in (wrap(str(line), 92) or [""])]
    # Use a readable 12-point type size while keeping a safe bottom margin.
    pages = [wrapped_lines[index:index + 42] for index in range(0, len(wrapped_lines), 42)] or [[]]
    objects: list[bytes] = []
    page_ids: list[int] = []
    font_id = 3
    next_id = 4
    for page_lines in pages:
        commands = ["BT", "/F1 12 Tf", "50 760 Td"]
        for index, line in enumerate(page_lines):
            if index:
                commands.append("0 -17 Td")
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
        "Sherwood College",
        "Entrance Test Syllabus",
        f"Application ID: {application_number}",
        f"Student: {student_name}",
        "",
        "SYLLABUS",
    ]
    for item in syllabus:
        lines.extend([f"{item['subject']}", f"  {item['details']}", ""])
    return _application_pdf(application_number=application_number, student_name=student_name, desired_class="Entrance Test", form_lines=lines[5:])


def _send_messages(messages: list[tuple[str, str, str, str | None, list[tuple[str, bytes, str]]]]) -> None:
    """Send individual messages so administrator addresses are never exposed."""
    if not _valid_email(configured_sender()):
        logger.warning("Admission email notifications skipped because no sender email is configured.")
        return

    for recipient, subject, body, html_body, attachments in messages:
        try:
            send_email(recipient=recipient, subject=subject, body=body, html_body=html_body, attachments=attachments)
        except Exception:
            # One failed recipient must not prevent the others from receiving it.
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
    payment_amount: str = "",
    transaction_id: str = "",
) -> None:
    """Notify the applicant and every configured admin after confirmed payment."""
    parent_recipient = _valid_email(parent_email)
    parent_display_name = parent_name.strip() or "Parent"
    student_display_name = student_name.strip() or "Applicant"
    application_display = application_number.strip()
    class_display = desired_class.strip() or "selected class"
    completed_form = _completed_application_form(application_data, documents)
    payment_lines = ["REGISTRATION FEE PAYMENT CONFIRMED", ""]
    if payment_amount:
        payment_lines.append(f"Registration fee paid: ₹{payment_amount}")
    if transaction_id:
        payment_lines.append(f"Easebuzz transaction reference: {transaction_id}")
    payment_lines.append("")
    completed_application = [*payment_lines, "COMPLETED APPLICATION FORM", *completed_form]
    attachment_stem = re.sub(r"[^A-Za-z0-9._-]", "-", application_display) or "application"
    attachments = [(f"{attachment_stem}-application.pdf", _application_pdf(application_number=application_display, student_name=student_display_name, desired_class=class_display, form_lines=completed_application), "application/pdf")]
    try:
        attachments.append((
            f"{attachment_stem}-application.pptx",
            build_admission_pptx(application_number=application_display, student_name=student_display_name, desired_class=class_display, form_lines=completed_application),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ))
    except Exception:
        logger.exception("Admission PowerPoint attachment could not be created.")
    messages: list[tuple[str, str, str, str | None, list[tuple[str, bytes, str]]]] = []

    if parent_recipient:
        messages.append((
            parent_recipient,
            f"Registration payment received — {application_display}",
            "\n".join([
                f"Dear {parent_display_name},",
                "",
                f"We have received the registration payment and admission application for {student_display_name}.",
                f"Application ID: {application_display}",
                f"Class applying for: {class_display}",
                "",
                *payment_lines,
                "Your application is now with the Admissions Office for review. We will email you with the next steps.",
                "Please retain this email and the transaction reference for your records.",
                "",
                "Sherwood College Admissions",
            ]),
            _application_html(
                title="Registration payment received",
                student_name=student_display_name,
                application_number=application_display,
                desired_class=class_display,
                form_lines=payment_lines,
                closing="Your application is now with the Admissions Office for review. Please retain this email and the transaction reference for your records.",
            ),
            attachments,
        ))

    for admin_email in _admin_recipients():
        messages.append((
            admin_email,
            f"New paid admission application — {application_display}",
            "\n".join([
                "A new admission application and registration payment have been confirmed.",
                "",
                f"Student: {student_display_name}",
                f"Application ID: {application_display}",
                f"Class applying for: {class_display}",
                "",
                *payment_lines,
                "COMPLETED APPLICATION FORM",
                *completed_form,
                "Open the Admin Admissions dashboard to review documents and update the application.",
            ]),
            _application_html(
                title="New paid admission application",
                student_name=student_display_name,
                application_number=application_display,
                desired_class=class_display,
                form_lines=completed_application,
                closing="Open the Admin Admissions dashboard to review documents and update the application.",
            ),
            attachments,
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
        f"We are pleased to inform you that {display_student}'s admission application has been accepted by Sherwood College.",
        "", f"Application ID: {application_number}", "", *syllabus_lines, "",
        "Please keep the attached syllabus for the entrance-test preparation.",
        "For further instructions, sign in to the parent admission portal or contact the admissions office.",
        "", "Regards,", "Admissions Office", "Sherwood College",
    ])
    attachment = [(f"{application_number.replace('/', '-')}-entrance-syllabus.pdf", _syllabus_pdf(application_number=application_number, student_name=display_student, syllabus=syllabus), "application/pdf")]
    _send_messages([(
        recipient,
        f"Admission accepted — {application_number}",
        body,
        _application_html(
            title="Admission accepted",
            student_name=display_student,
            application_number=application_number,
            desired_class="Entrance Test",
            form_lines=syllabus_lines,
            closing="Please keep the attached syllabus for entrance-test preparation. Sign in to the parent admission portal or contact the Admissions Office for further instructions.",
        ),
        attachment,
    )])
