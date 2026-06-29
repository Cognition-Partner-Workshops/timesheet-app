"""Persistent EWA booking ledger (PostgreSQL).

When an EWA proposal clears *both* approval gates (Delivery Fit + Business Fit)
the employee is recorded in the ``ewa_bookings`` table. The recommendation
engine then treats those employees as booked and stops surfacing them in new
staffing options, so the same person cannot be proposed/approved twice.

This is the one place the runtime *writes* to Postgres. It reuses the same
connection settings as the pgvector retrieval layer. If Postgres is unavailable
the functions degrade gracefully (a booking is skipped, the booked set is empty)
so the rest of the app keeps working without a database.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from . import config

logger = logging.getLogger(__name__)

_TABLE = "ewa_bookings"
_table_ready = False


def _connect():
    if not config.PG_ENABLED:
        return None
    try:
        import psycopg2
    except ImportError:  # pragma: no cover
        logger.warning("psycopg2 not installed; EWA bookings run without persistence")
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
        logger.warning("Could not connect to PostgreSQL for bookings: %s", exc)
        return None


def _ensure_table(conn) -> None:
    """Create the bookings table on first use (idempotent)."""
    global _table_ready
    if _table_ready:
        return
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_TABLE} (
                ewa_request_id      TEXT PRIMARY KEY,
                employee_id         TEXT NOT NULL,
                employee_name       TEXT,
                role_name           TEXT,
                opportunity_summary TEXT,
                booked_at           TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_employee "
            f"ON {_TABLE} (employee_id);"
        )
    conn.commit()
    _table_ready = True


def record_booking(
    ewa_request_id: str,
    employee_id: str,
    employee_name: Optional[str] = None,
    role_name: Optional[str] = None,
    opportunity_summary: Optional[str] = None,
) -> bool:
    """Persist a confirmed booking. Returns True when written to Postgres.

    Idempotent on ``ewa_request_id`` so re-approving the same request is safe.
    """
    conn = _connect()
    if conn is None:
        return False
    try:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {_TABLE}
                    (ewa_request_id, employee_id, employee_name,
                     role_name, opportunity_summary, booked_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (ewa_request_id) DO UPDATE SET
                    employee_id = EXCLUDED.employee_id,
                    employee_name = EXCLUDED.employee_name,
                    role_name = EXCLUDED.role_name,
                    opportunity_summary = EXCLUDED.opportunity_summary;
                """,
                (
                    ewa_request_id,
                    employee_id,
                    employee_name,
                    role_name,
                    opportunity_summary,
                    datetime.now(timezone.utc),
                ),
            )
        conn.commit()
        return True
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not record EWA booking: %s", exc)
        return False
    finally:
        conn.close()


def booked_employee_ids() -> set[str]:
    """Return the set of employee_ids that have a confirmed EWA booking."""
    conn = _connect()
    if conn is None:
        return set()
    try:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(f"SELECT DISTINCT employee_id FROM {_TABLE};")
            return {row[0] for row in cur.fetchall()}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not read EWA bookings: %s", exc)
        return set()
    finally:
        conn.close()
