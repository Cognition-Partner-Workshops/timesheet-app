"""PII masking helpers for raw source payloads and evidence text.

Employee names are encrypted in employees.employee_name_encrypted, but raw JSON
payloads are still sanitized by default so sensitive fields are not duplicated.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from src.utils import clean_text, json_safe, is_blank

SENSITIVE_KEY_FRAGMENTS = {
    "ssn",
    "social_security",
    "socialsecurity",
    "aadhaar",
    "aadhar",
    "pan",
    "passport",
    "national_id",
    "nationalid",
    "tax_id",
    "taxid",
    "phone",
    "mobile",
    "email",
    "dob",
    "birth",
    "address",
}

NAME_KEYS = {"employee_name", "name", "full_name"}


def should_mask_key(key: str, store_raw_pii: bool) -> bool:
    if store_raw_pii:
        return False
    normalized = key.lower().replace(" ", "_").replace("-", "_")
    if normalized in NAME_KEYS:
        return True
    return any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS)


def mask_value(value: Any) -> str:
    text = "" if value is None else str(value)
    if len(text) <= 4:
        return "****"
    return "****" + text[-4:]


def sanitize_payload(row: Dict[str, Any], store_raw_pii: bool = False) -> Dict[str, Any]:
    payload = {}
    for key, value in row.items():
        safe_value = json_safe(value)
        if should_mask_key(key, store_raw_pii) and not is_blank(value):
            safe_value = mask_value(value)
        payload[key] = safe_value
    return payload


def replace_employee_name(text: Any, employee_name: Any, employee_token: str) -> Optional[str]:
    """Removes real employee name from evidence text.

    Evidence snippets can use token C0001. UI can still show decrypted name from
    employees.employee_name_encrypted when authorized.
    """
    if is_blank(text):
        return None
    out = str(text).strip()
    name = clean_text(employee_name)
    if name:
        out = out.replace(name, employee_token)
    return out
