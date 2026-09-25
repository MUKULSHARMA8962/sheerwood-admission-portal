"""Verify complete admission emails and their attachments without sending mail."""

from __future__ import annotations

from io import BytesIO
from unittest import TestCase
from unittest.mock import patch
from xml.etree import ElementTree
from zipfile import ZipFile

from app import notifications
from app.email_service import send_email


class AdmissionNotificationTests(TestCase):
    def test_submission_has_all_form_fields_and_both_attachments(self) -> None:
        form = {
            "admissionDetails": {"session": "2027-28", "class": "Class 5", "boardOther": ""},
            "student": {"firstName": "Asha", "middleName": "", "lastName": "Singh", "howHeard": "<script>"},
            "guardians": {"Father": {"fullName": "Mr Singh", "email": "father@example.com"}},
            "studentPhoto": {"file": "asha.png", "storageId": "private-id"},
            "parentPhotos": {"Father": {"file": "father.png"}},
            "extraColumn": "Extra value",
        }
        documents = [
            {"name": "Report Card", "file": "report.pdf", "status": "Uploaded"},
            {"name": "Birth Certificate", "file": "", "status": "Not Uploaded"},
        ]
        with patch.object(notifications, "configured_sender", return_value="sender@example.com"), \
             patch.object(notifications, "_admin_recipients", return_value={"admin@example.com"}), \
             patch.object(notifications, "send_email") as send:
            notifications.send_admission_submission_notifications(
                parent_email="parent@example.com",
                parent_name="Mr Singh",
                student_name="Asha Singh",
                application_number="APP/2027/1",
                desired_class="Class 5",
                application_data=form,
                documents=documents,
                payment_amount="1,500.00",
                transaction_id="SHW123",
            )

        self.assertEqual(send.call_count, 2)
        for call in send.call_args_list:
            message = call.kwargs
            self.assertIn("REGISTRATION FEE PAYMENT CONFIRMED", message["body"])
            self.assertIn("Registration fee paid: ₹1,500.00", message["body"])
            self.assertIn("Easebuzz transaction reference: SHW123", message["body"])
            attachment_types = {item[2] for item in message["attachments"]}
            self.assertEqual(attachment_types, {
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            })
            deck = next(item[1] for item in message["attachments"] if item[0].endswith(".pptx"))
            with ZipFile(BytesIO(deck)) as package:
                self.assertIsNone(package.testzip())
                xml_parts = [name for name in package.namelist() if name.endswith((".xml", ".rels"))]
                for name in xml_parts:
                    ElementTree.fromstring(package.read(name))
                slide_text = " ".join(
                    package.read(name).decode("utf-8")
                    for name in package.namelist()
                    if name.startswith("ppt/slides/slide") and name.endswith(".xml")
                )
                self.assertIn("Extra Column: Extra value", slide_text)
                self.assertIn("Middle Name: Not provided", slide_text)

        messages = {call.kwargs["recipient"]: call.kwargs for call in send.call_args_list}
        parent_message = messages["parent@example.com"]
        self.assertEqual(parent_message["subject"], "Registration payment received — APP/2027/1")
        self.assertIn("Admissions Office for review", parent_message["body"])
        self.assertNotIn("Aadhaar Number", parent_message["body"])

        admin_message = messages["admin@example.com"]
        self.assertEqual(admin_message["subject"], "New paid admission application — APP/2027/1")
        self.assertIn("Middle Name: Not provided", admin_message["body"])
        self.assertIn("PEN Number: Not provided", admin_message["body"])
        self.assertIn("Extra Column: Extra value", admin_message["body"])
        self.assertIn("Student Photograph: asha.png", admin_message["body"])
        self.assertIn("Birth Certificate: Not uploaded", admin_message["body"])
        self.assertNotIn("private-id", admin_message["body"])
        self.assertIn("&lt;script&gt;", admin_message["html_body"])
        self.assertNotIn("<script>", admin_message["html_body"])
        self.assertIn("background:#12c9e8", admin_message["html_body"])
        self.assertIn(">SHEERWOOD<", admin_message["html_body"].upper())

    def test_one_delivery_failure_does_not_skip_other_recipients(self) -> None:
        with patch.object(notifications, "configured_sender", return_value="sender@example.com"), \
             patch.object(notifications, "send_email", side_effect=[RuntimeError("offline"), None]) as send, \
             patch.object(notifications.logger, "exception"):
            notifications._send_messages([
                ("parent@example.com", "Subject", "Body", None, []),
                ("admin@example.com", "Subject", "Body", None, []),
            ])
        self.assertEqual(send.call_count, 2)

    def test_gmail_message_contains_html_and_pptx(self) -> None:
        settings = {
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_PORT": "587",
            "SMTP_USERNAME": "sender@gmail.com",
            "SMTP_PASSWORD": "test-app-password",
        }
        with patch.dict("os.environ", settings, clear=True), \
             patch("app.email_service.smtplib.SMTP") as smtp:
            send_email(
                recipient="parent@example.com",
                subject="Admission received",
                body="Plain text form",
                html_body="<p>Formatted form</p>",
                attachments=[("application.pptx", b"pptx-data", "application/vnd.openxmlformats-officedocument.presentationml.presentation")],
            )
        connection = smtp.return_value.__enter__.return_value
        connection.starttls.assert_called_once()
        connection.login.assert_called_once_with("sender@gmail.com", "test-app-password")
        message = connection.send_message.call_args.args[0]
        self.assertEqual(message["From"], "sender@gmail.com")
        self.assertEqual(message.get_body(preferencelist=("html",)).get_content().strip(), "<p>Formatted form</p>")
        self.assertEqual([part.get_filename() for part in message.iter_attachments()], ["application.pptx"])


if __name__ == "__main__":
    import unittest

    unittest.main()
