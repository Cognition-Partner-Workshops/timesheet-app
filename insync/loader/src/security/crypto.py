"""Encryption helpers for employee names.

Employee names are encrypted at rest in PostgreSQL. The UI/backend can decrypt
only if it has the same FERNET_KEY configured.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


def generate_fernet_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def build_cipher(fernet_key: str) -> Fernet:
    if not fernet_key or fernet_key.startswith("replace_with"):
        raise ValueError(
            "FERNET_KEY is missing. Generate one with: python -m src.security.crypto --generate-key"
        )
    return Fernet(fernet_key.encode("utf-8"))


def encrypt_text(value: Optional[str], fernet_key: str) -> Optional[str]:
    if value is None or str(value).strip() == "":
        return None
    cipher = build_cipher(fernet_key)
    return cipher.encrypt(str(value).encode("utf-8")).decode("utf-8")


def decrypt_text(token: Optional[str], fernet_key: str) -> Optional[str]:
    if token is None or str(token).strip() == "":
        return None
    cipher = build_cipher(fernet_key)
    try:
        return cipher.decrypt(str(token).encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt value. Check FERNET_KEY.") from exc


def hash_for_lookup(value: Optional[str], salt: str) -> Optional[str]:
    """Creates a stable exact-match hash for encrypted fields.

    This allows exact lookup without storing the raw name. It is not reversible.
    """
    if value is None or str(value).strip() == "":
        return None
    if not salt or salt.startswith("replace_with"):
        raise ValueError("NAME_HASH_SALT is missing. Set NAME_HASH_SALT in .env.")
    normalized = " ".join(str(value).strip().lower().split())
    return hmac.new(salt.encode("utf-8"), normalized.encode("utf-8"), hashlib.sha256).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate-key", action="store_true", help="Print a new Fernet key")
    args = parser.parse_args()
    if args.generate_key:
        print(generate_fernet_key())


if __name__ == "__main__":
    main()
