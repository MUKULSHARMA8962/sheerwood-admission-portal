"""AWS SES email delivery for server-side notifications."""

from __future__ import annotations

import os

import boto3


def send_email(*, recipient: str, subject: str, body: str) -> None:
    sender = os.getenv("SES_FROM_EMAIL", "admissions@sheerwoodadmission.com").strip()
    if not sender:
        raise ValueError("SES_FROM_EMAIL must be configured on the server.")

    ses = boto3.client("ses", region_name=os.getenv("AWS_REGION", "us-east-1"))
    ses.send_email(
        Source=sender,
        Destination={"ToAddresses": [recipient]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
        },
    )