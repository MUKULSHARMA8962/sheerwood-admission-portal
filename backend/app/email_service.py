"""Server-side email delivery for notifications and one-time passwords."""

from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage

import boto3


def configured_sender() -> str:
    """Return the From address used by the active delivery provider."""
    return (
        os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("SES_FROM_EMAIL")
        or "admissions@sheerwoodadmission.com"
    ).strip()


def _send_via_smtp(*, recipient: str, subject: str, body: str, sender: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise ValueError("SMTP_PORT must be a valid port number.") from exc

    if not host or not username or not password:
        raise ValueError("SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD must be configured.")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    tls_context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=tls_context)
        smtp.ehlo()
        smtp.login(username, password)
        smtp.send_message(message)


def send_email(*, recipient: str, subject: str, body: str) -> None:
    """Deliver through SMTP when configured, otherwise use the AWS SES API."""
    sender = configured_sender()
    if not sender:
        raise ValueError("A sender email address must be configured on the server.")

    if os.getenv("SMTP_HOST", "").strip():
        _send_via_smtp(recipient=recipient, subject=subject, body=body, sender=sender)
        return

    ses = boto3.client("ses", region_name=os.getenv("AWS_REGION", "us-east-1"))
    ses.send_email(
        Source=sender,
        Destination={"ToAddresses": [recipient]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
        },
    )
