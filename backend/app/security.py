import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta


def hash_password(password: str, salt: str | None = None) -> str:
    current_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), current_salt.encode(), 310_000)
    return f"{current_salt}${digest.hex()}"


def verify_password(password: str, stored_value: str) -> bool:
    salt, _, expected_digest = stored_value.partition("$")
    if not salt or not expected_digest:
        return False
    actual_digest = hash_password(password, salt).partition("$")[2]
    return hmac.compare_digest(actual_digest, expected_digest)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def session_expiry() -> str:
    return (datetime.now(UTC) + timedelta(hours=12)).isoformat()
