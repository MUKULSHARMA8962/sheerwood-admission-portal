"""Send one test email through the backend's Gmail SMTP configuration."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv

from app.email_service import send_email


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a Sheerwood Gmail SMTP test email.")
    parser.add_argument("recipient", help="Email address that should receive the test")
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parent / ".env")
    if os.getenv("SMTP_HOST", "").strip().lower() != "smtp.gmail.com":
        parser.error("SMTP_HOST must be smtp.gmail.com to run this Gmail test.")

    send_email(
        recipient=args.recipient,
        subject="Sheerwood Email Test",
        body="Hello! Gmail SMTP is working successfully.",
    )
    print("Email sent successfully.")


if __name__ == "__main__":
    main()
