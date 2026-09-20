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


def resolve_referral(source: str | None, referral_code: str | None = None) -> Referral | None:
    normalized_source = str(source or "").strip().lower()
    referral = REFERRALS.get(normalized_source)
    if not referral:
        return None

    normalized_code = str(referral_code or "").strip().upper()
    if normalized_code and normalized_code != referral.referral_code:
        return None
    return referral
