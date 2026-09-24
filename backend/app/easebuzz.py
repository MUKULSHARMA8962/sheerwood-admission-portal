"""Server-side Easebuzz hosted-checkout signing and transaction verification."""

from decimal import Decimal, InvalidOperation
import hashlib
import hmac
import os
import re

import httpx


PRODUCT_INFO = "Sheerwood admission registration fee"
HASH_FIELDS = ("key", "txnid", "amount", "productinfo", "firstname", "email", *(f"udf{i}" for i in range(1, 11)))
REVERSE_FIELDS = ("status", *(f"udf{i}" for i in range(10, 0, -1)), "email", "firstname", "productinfo", "amount", "txnid", "key")


class EasebuzzError(Exception):
    pass


def configuration() -> tuple[str, str, str]:
    key = os.getenv("EASEBUZZ_MERCHANT_KEY", "").strip()
    salt = os.getenv("EASEBUZZ_SALT", "").strip()
    environment = os.getenv("EASEBUZZ_ENV", "test").strip().lower()
    if not key or not salt:
        raise EasebuzzError("Easebuzz merchant key and salt are not configured on the server.")
    if environment not in {"test", "prod"}:
        raise EasebuzzError("EASEBUZZ_ENV must be test or prod.")
    return key, salt, environment


def pay_base(environment: str) -> str:
    return "https://pay.easebuzz.in" if environment == "prod" else "https://testpay.easebuzz.in"


def dashboard_base(environment: str) -> str:
    return "https://dashboard.easebuzz.in" if environment == "prod" else "https://testdashboard.easebuzz.in"


def amount_matches(value: object, expected: str) -> bool:
    try:
        return Decimal(str(value)) == Decimal(expected)
    except (InvalidOperation, TypeError, ValueError):
        return False


def verify_response_hash(payload: dict[str, str]) -> bool:
    key, salt, _ = configuration()
    received = payload.get("hash", "")
    if payload.get("key") != key or not re.fullmatch(r"[0-9a-fA-F]{128}", received):
        return False
    signed = "|".join((salt, *(str(payload.get(field, "")) for field in REVERSE_FIELDS)))
    expected = hashlib.sha512(signed.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected, received.lower())


def initiate_payment(*, txnid: str, amount: str, firstname: str, email: str, phone: str, application_number: str) -> str:
    key, salt, environment = configuration()
    callback_url = os.getenv("EASEBUZZ_CALLBACK_URL", "").strip()
    if not callback_url.startswith("https://") and not (environment == "test" and callback_url.startswith("http://localhost:")):
        raise EasebuzzError("Set EASEBUZZ_CALLBACK_URL to the public HTTPS payment return endpoint.")
    payload = {
        "key": key, "txnid": txnid, "amount": amount, "productinfo": PRODUCT_INFO,
        "firstname": firstname, "email": email, "phone": phone,
        "surl": callback_url, "furl": callback_url, "udf1": application_number,
    }
    signed = "|".join((*(str(payload.get(field, "")) for field in HASH_FIELDS), salt))
    payload["hash"] = hashlib.sha512(signed.encode("utf-8")).hexdigest()
    try:
        response = httpx.post(f"{pay_base(environment)}/payment/initiateLink", data=payload, timeout=20)
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise EasebuzzError("Easebuzz could not start the payment. Please try again.") from error
    access_key = result.get("data") if isinstance(result, dict) and str(result.get("status")) == "1" else None
    if not isinstance(access_key, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", access_key):
        raise EasebuzzError("Easebuzz declined the payment initiation. Check merchant configuration or try again.")
    return f"{pay_base(environment)}/pay/{access_key}"


def retrieve_transaction(txnid: str) -> dict:
    key, salt, environment = configuration()
    signed = f"{key}|{txnid}|{salt}"
    try:
        response = httpx.post(
            f"{dashboard_base(environment)}/transaction/v2/retrieve",
            data={"key": key, "txnid": txnid, "hash": hashlib.sha512(signed.encode("utf-8")).hexdigest()},
            timeout=20,
        )
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise EasebuzzError("Could not verify payment with Easebuzz. Please retry shortly.") from error
    if not isinstance(result, dict):
        raise EasebuzzError("Unexpected Easebuzz transaction response.")
    return result


def verified_transaction(result: dict, *, txnid: str, amount: str) -> dict | None:
    """Only accept an explicitly successful transaction with matching ID and amount."""
    if str(result.get("status")) != "1":
        return None
    candidates = [result.get("data"), result.get("msg")]
    for candidate in candidates:
        if isinstance(candidate, list):
            candidate = candidate[0] if len(candidate) == 1 else None
        if not isinstance(candidate, dict):
            continue
        transaction_status = str(candidate.get("status", "")).lower()
        if transaction_status != "success":
            continue
        if str(candidate.get("txnid", "")) != txnid or not amount_matches(candidate.get("amount"), amount):
            continue
        return candidate
    return None
