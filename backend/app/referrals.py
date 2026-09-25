"""Validated vendor attribution for admission referrals."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Referral:
    source: str
    vendor_id: str
    default_campaign_id: str
    referral_code: str


REFERRALS = {
    "direct": Referral("direct", "DIRECT", "ORGANIC", ""),
    "edustoke": Referral("edustoke", "EDU001", "EDUSTOKE_ADMISSIONS", "EDU001"),
    "ezyschooling": Referral("ezyschooling", "EZY001", "EZYSCHOOLING_ADMISSIONS", "EZY001"),
    "global_education": Referral("global_education", "GLO001", "GLOBAL_EDUCATION_ADMISSIONS", "GLO001"),
    "edhippo": Referral("edhippo", "HIP001", "EDHIPPO_ADMISSIONS", "HIP001"),
}


def resolve_referral(source: str | None, referral_code: str | None = None, database=None) -> Referral | None:
    normalized_source = str(source or "").strip().lower()
    normalized_code = str(referral_code or "").strip().upper()
    if normalized_source == "vendor" and normalized_code and database is not None:
        vendor = database.execute(
            "SELECT vendor_id, referral_code FROM vendor_accounts WHERE referral_code = ? AND is_enabled = 1",
            (normalized_code,),
        ).fetchone()
        if vendor:
            return Referral("vendor", vendor["vendor_id"], f"VENDOR_{vendor['vendor_id']}", vendor["referral_code"])
        return None

    referral = REFERRALS.get(normalized_source)
    if not referral:
        return None

    if normalized_code and normalized_code != referral.referral_code:
        return None
    return referral
