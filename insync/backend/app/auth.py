"""Lightweight username/password auth for the TalentBridge demo.

Design goals:
  * No heavy dependencies — PBKDF2 hashing (stdlib ``hashlib``) and HMAC-signed
    stateless tokens (stdlib ``hmac``). Good enough for a hackathon demo, and
    nothing here is a substitute for a real IdP in production.
  * Persisted to a small JSON file so sign-ups survive a server restart.
  * Three roles, matching the requirement doc: Workforce Planner, Delivery
    Manager and Client Manager (a.k.a. Sales / Client Partner).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

from . import config

ROLE_PLANNER = "workforce_planner"
ROLE_DELIVERY = "delivery_manager"
ROLE_CLIENT = "client_manager"

VALID_ROLES = {ROLE_PLANNER, ROLE_DELIVERY, ROLE_CLIENT}

ROLE_LABELS = {
    ROLE_PLANNER: "Workforce Planner",
    ROLE_DELIVERY: "Delivery Manager",
    ROLE_CLIENT: "Client Manager",
}

# Where each role lands after signing in (requirement §7).
ROLE_LANDING = {
    ROLE_PLANNER: "/dashboard",
    ROLE_DELIVERY: "/people",
    ROLE_CLIENT: "/intake",
}

_USERS_FILE = config.BACKEND_ROOT / "data" / "users.json"
_TOKEN_TTL = 60 * 60 * 12  # 12 hours
_lock = threading.Lock()


@dataclass
class User:
    id: str
    full_name: str
    email: str
    role: str
    password_hash: str
    created_at: float

    def public(self) -> dict:
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "role_label": ROLE_LABELS.get(self.role, self.role),
            "landing": ROLE_LANDING.get(self.role, "/people"),
        }


# --------------------------------------------------------------------------- #
# Password hashing                                                             #
# --------------------------------------------------------------------------- #
def hash_password(password: str, *, salt: Optional[bytes] = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, iters, salt_hex, digest_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iters)
        )
        return hmac.compare_digest(expected.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
# Token signing (stateless HMAC)                                               #
# --------------------------------------------------------------------------- #
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    pad = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + pad)


def issue_token(user: User) -> str:
    payload = json.dumps(
        {"sub": user.id, "role": user.role, "exp": int(time.time()) + _TOKEN_TTL},
        separators=(",", ":"),
    ).encode("utf-8")
    body = _b64(payload)
    sig = hmac.new(
        config.AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{body}.{_b64(sig)}"


def verify_token(token: str) -> Optional[dict]:
    try:
        body, sig = token.split(".")
    except ValueError:
        return None
    expected = hmac.new(
        config.AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(_b64(expected), sig):
        return None
    try:
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


# --------------------------------------------------------------------------- #
# User store (JSON-backed)                                                     #
# --------------------------------------------------------------------------- #
class UserStore:
    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._load()
        self._seed_demo_users()

    def _load(self) -> None:
        if _USERS_FILE.exists():
            try:
                raw = json.loads(_USERS_FILE.read_text(encoding="utf-8"))
                for rec in raw:
                    user = User(**rec)
                    self._users[user.email.lower()] = user
            except (ValueError, TypeError):
                self._users = {}

    def _persist(self) -> None:
        _USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _USERS_FILE.write_text(
            json.dumps([asdict(u) for u in self._users.values()], indent=2),
            encoding="utf-8",
        )

    def _seed_demo_users(self) -> None:
        """Seed one ready-to-use account per role so reviewers can log straight in."""
        demo = [
            ("Sarah Chen", "sarah@talentbridge.demo", ROLE_PLANNER),
            ("Raj Patel", "raj@talentbridge.demo", ROLE_DELIVERY),
            ("Jenny Alvarez", "jenny@talentbridge.demo", ROLE_CLIENT),
        ]
        changed = False
        for name, email, role in demo:
            if email.lower() not in self._users:
                self._users[email.lower()] = User(
                    id=secrets.token_hex(8),
                    full_name=name,
                    email=email,
                    role=role,
                    password_hash=hash_password("demo1234"),
                    created_at=time.time(),
                )
                changed = True
        if changed:
            self._persist()

    def get_by_email(self, email: str) -> Optional[User]:
        return self._users.get(email.lower())

    def get_by_id(self, user_id: str) -> Optional[User]:
        for user in self._users.values():
            if user.id == user_id:
                return user
        return None

    def create(self, full_name: str, email: str, password: str, role: str) -> User:
        with _lock:
            if self.get_by_email(email):
                raise ValueError("An account with this email already exists.")
            if role not in VALID_ROLES:
                raise ValueError("Invalid role.")
            user = User(
                id=secrets.token_hex(8),
                full_name=full_name.strip(),
                email=email.strip(),
                role=role,
                password_hash=hash_password(password),
                created_at=time.time(),
            )
            self._users[email.lower()] = user
            self._persist()
            return user


_store: Optional[UserStore] = None


def get_store() -> UserStore:
    global _store
    if _store is None:
        _store = UserStore()
    return _store
