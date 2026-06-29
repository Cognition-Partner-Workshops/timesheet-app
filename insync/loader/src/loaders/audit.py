"""Audit event helpers."""

from __future__ import annotations

from datetime import datetime

from psycopg2.extras import Json

from src.config import AppConfig
from src.db import fetch_one


def insert_import_audit_event(conn, config: AppConfig):
    planner = fetch_one(conn, "SELECT user_id FROM users WHERE default_role = 'WORKFORCE_PLANNER' ORDER BY created_at LIMIT 1")
    actor_user_id = planner["user_id"] if planner else None

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_events (
                entity_type,
                entity_id,
                actor_user_id,
                actor_role,
                action,
                old_value,
                new_value
            )
            VALUES ('SYSTEM', NULL, %s, 'SYSTEM', 'EXCEL_IMPORT_COMPLETED', NULL, %s)
            """,
            (
                actor_user_id,
                Json({"excel_path": config.excel_path, "completed_at_utc": datetime.utcnow().isoformat()}),
            ),
        )
