"""Username/password auth for the TalentBridge demo, backed by PostgreSQL.

Design goals:
  * No heavy dependencies — PBKDF2 hashing (stdlib ``hashlib``) and HMAC-signed
    stateless tokens (stdlib ``hmac``). Good enough for a hackathon demo, and
    nothing here is a substitute for a real IdP in production.
  * Persisted to PostgreSQL (the same ``users`` table the staffing workflow
    references) so sign-ups and demo accounts survive a server restart.
  * Three roles, matching the requirement doc: Workforce Planner, Delivery
    Manager and Client Manager (a.k.a. Sales / Client Partner).

The schema is created by ``loader/sql/05_auth.sql`` (password_hash, status,
updated_at columns on the existing ``users`` table). Demo users are seeded
idempotently at startup.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

from . import config

logger = logging.getLogger(__name__)

ROLE_PLANNER = "workforce_planner"
ROLE_DELIVERY = "delivery_manager"
ROLE_CLIENT = "client_manager"

VALID_ROLES = {ROLE_PLANNER, ROLE_DELIVERY, ROLE_CLIENT}

ROLE_LABELS = {
    ROLE_PLANNER: "Workforce Planner",
    ROLE_DELIVERY: "Delivery Manager",
    ROLE_CLIENT: "Client Manager",
}

# Where each role lands after signing in (requirement §6).
ROLE_LANDING = {
    ROLE_PLANNER: "/dashboard",
    ROLE_DELIVERY: "/people",
    ROLE_CLIENT: "/intake",
}

# Map the app's auth role <-> the DB users.default_role value.
_APP_TO_DB_ROLE = {
    ROLE_PLANNER: "WORKFORCE_PLANNER",
    ROLE_DELIVERY: "DELIVERY_MANAGER",
    ROLE_CLIENT: "CLIENT_MANAGER",
}
_DB_TO_APP_ROLE = {v: k for k, v in _APP_TO_DB_ROLE.items()}

_TOKEN_TTL = 60 * 60 * 12  # 12 hours


class AuthUnavailable(RuntimeError):
    """Raised when the user store (PostgreSQL) cannot be reached."""


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
# User store (PostgreSQL-backed)                                               #
# --------------------------------------------------------------------------- #
# Demo accounts seeded so reviewers can log straight in (requirement §5).
_DEMO_USERS = [
    ("Sarah Chen", "sarah@talentbridge.demo", ROLE_PLANNER),
    ("Raj Patel", "raj@talentbridge.demo", ROLE_DELIVERY),
    ("Jenny Alvarez", "jenny@talentbridge.demo", ROLE_CLIENT),
]
_DEMO_PASSWORD = "demo1234"


def _connect():
    if not config.PG_ENABLED:
        return None
    try:
        import psycopg2
    except ImportError:  # pragma: no cover
        logger.warning("psycopg2 not installed; auth persistence disabled")
        return None
    try:
        return psycopg2.connect(
            host=config.PG_HOST,
            port=config.PG_PORT,
            dbname=config.PG_DATABASE,
            user=config.PG_USER,
            password=config.PG_PASSWORD,
            connect_timeout=3,
        )
    except Exception as exc:
        logger.warning("Could not connect to PostgreSQL for auth: %s", exc)
        return None


def _dict_cursor(conn):
    import psycopg2.extras

    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def _row_to_user(row: dict) -> User:
    db_role = (row.get("default_role") or "").upper()
    return User(
        id=str(row["user_id"]),
        full_name=row.get("full_name") or "",
        email=row.get("email") or "",
        role=_DB_TO_APP_ROLE.get(db_role, ROLE_PLANNER),
        password_hash=row.get("password_hash") or "",
        created_at=(
            row["created_at"].timestamp() if row.get("created_at") else time.time()
        ),
    )


class UserStore:
    """PostgreSQL-backed user store. No JSON / in-memory primary state."""

    def __init__(self) -> None:
        self._ensure_schema()
        self._seed_demo_users()

    # -- schema ----------------------------------------------------------- #
    def _ensure_schema(self) -> None:
        """Make sure the auth columns exist even if the SQL migration wasn't run.

        Mirrors ``loader/sql/05_auth.sql`` so the app is self-healing for demos.
        """
        conn = _connect()
        if conn is None:
            logger.warning("Auth schema check skipped — PostgreSQL unavailable.")
            return
        try:
            with conn, conn.cursor() as cur:
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT "
                    "NOT NULL DEFAULT 'active';"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP "
                    "NOT NULL DEFAULT now();"
                )
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not ensure auth schema: %s", exc)
        finally:
            conn.close()

    # -- seeding ---------------------------------------------------------- #
    def _seed_demo_users(self) -> None:
        """Idempotently seed one ready-to-use account per role."""
        conn = _connect()
        if conn is None:
            logger.warning("Demo user seed skipped — PostgreSQL unavailable.")
            return
        try:
            with conn, conn.cursor() as cur:
                for name, email, role in _DEMO_USERS:
                    db_role = _APP_TO_DB_ROLE[role]
                    cur.execute(
                        "SELECT user_id, password_hash FROM users "
                        "WHERE lower(email) = lower(%s);",
                        (email,),
                    )
                    existing = cur.fetchone()
                    if existing is None:
                        cur.execute(
                            "INSERT INTO users (full_name, email, default_role, "
                            "password_hash, status, active) "
                            "VALUES (%s, %s, %s, %s, 'active', true);",
                            (name, email, db_role, hash_password(_DEMO_PASSWORD)),
                        )
                    elif not existing[1]:
                        # Demo user exists (e.g. workflow seed) but has no password:
                        # set a valid demo password + role so the demo keeps working.
                        cur.execute(
                            "UPDATE users SET password_hash = %s, default_role = %s, "
                            "status = 'active', active = true WHERE user_id = %s;",
                            (hash_password(_DEMO_PASSWORD), db_role, existing[0]),
                        )
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not seed demo users: %s", exc)
        finally:
            conn.close()

    # -- queries ---------------------------------------------------------- #
    def get_by_email(self, email: str) -> Optional[User]:
        conn = _connect()
        if conn is None:
            raise AuthUnavailable("The user service is temporarily unavailable.")
        try:
            with conn, _dict_cursor(conn) as cur:
                cur.execute(
                    "SELECT user_id, full_name, email, default_role, password_hash, "
                    "created_at FROM users "
                    "WHERE lower(email) = lower(%s) AND status = 'active';",
                    (email.strip(),),
                )
                row = cur.fetchone()
                return _row_to_user(row) if row else None
        finally:
            conn.close()

    def get_by_id(self, user_id: str) -> Optional[User]:
        conn = _connect()
        if conn is None:
            raise AuthUnavailable("The user service is temporarily unavailable.")
        try:
            with conn, _dict_cursor(conn) as cur:
                cur.execute(
                    "SELECT user_id, full_name, email, default_role, password_hash, "
                    "created_at FROM users "
                    "WHERE user_id = %s AND status = 'active';",
                    (user_id,),
                )
                row = cur.fetchone()
                return _row_to_user(row) if row else None
        except Exception:
            # An invalid (non-uuid) id simply resolves to "no user".
            return None
        finally:
            conn.close()

    def create(self, full_name: str, email: str, password: str, role: str) -> User:
        if role not in VALID_ROLES:
            raise ValueError("Invalid role.")
        db_role = _APP_TO_DB_ROLE[role]
        conn = _connect()
        if conn is None:
            raise AuthUnavailable("The user service is temporarily unavailable.")
        try:
            with conn, _dict_cursor(conn) as cur:
                cur.execute(
                    "SELECT 1 FROM users WHERE lower(email) = lower(%s);",
                    (email.strip(),),
                )
                if cur.fetchone():
                    raise ValueError("An account with this email already exists.")
                cur.execute(
                    "INSERT INTO users (full_name, email, default_role, "
                    "password_hash, status, active) "
                    "VALUES (%s, %s, %s, %s, 'active', true) "
                    "RETURNING user_id, full_name, email, default_role, "
                    "password_hash, created_at;",
                    (
                        full_name.strip(),
                        email.strip(),
                        db_role,
                        hash_password(password),
                    ),
                )
                return _row_to_user(cur.fetchone())
        except ValueError:
            raise
        except Exception as exc:
            # e.g. unique-violation race — surface as a clear duplicate error.
            import psycopg2

            if isinstance(exc, psycopg2.errors.UniqueViolation):
                raise ValueError("An account with this email already exists.") from exc
            logger.warning("User insert failed: %s", exc)
            raise AuthUnavailable("Could not create the account. Please try again.")
        finally:
            conn.close()


_store: Optional[UserStore] = None


def get_store() -> UserStore:
    global _store
    if _store is None:
        _store = UserStore()
    return _store
