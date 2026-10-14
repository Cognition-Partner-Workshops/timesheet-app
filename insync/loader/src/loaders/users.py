"""Load app users and assign default stakeholders to projects."""

from __future__ import annotations

import logging

from src.config import AppConfig
from src.db import bulk_insert, fetch_all

logger = logging.getLogger(__name__)


def upsert_users(conn, config: AppConfig):
    rows = [
        (config.sarah_name, config.sarah_email, "WORKFORCE_PLANNER"),
        (config.jenny_name, config.jenny_email, "CLIENT_MANAGER"),
        (config.raj_name, config.raj_email, "DELIVERY_MANAGER"),
    ]
    sql = """
        INSERT INTO users (full_name, email, default_role)
        VALUES %s
        ON CONFLICT (email)
        DO UPDATE SET
            full_name = EXCLUDED.full_name,
            default_role = EXCLUDED.default_role,
            active = true
    """
    bulk_insert(conn, sql, rows, "users")


def upsert_default_project_stakeholders(conn):
    """Assign all seeded users to every project for the MVP.

    This is scalable: future managers are added as users and project_stakeholder
    rows without changing the schema.
    """
    users = fetch_all(conn, "SELECT user_id, default_role FROM users WHERE active = true")
    projects = fetch_all(conn, "SELECT project_id FROM projects")

    rows = []
    for project in projects:
        for user in users:
            role = user["default_role"]
            approval_required = role in {"CLIENT_MANAGER", "DELIVERY_MANAGER"}
            rows.append((project["project_id"], user["user_id"], role, approval_required, True))

    sql = """
        INSERT INTO project_stakeholders (
            project_id,
            user_id,
            stakeholder_role,
            approval_required,
            active
        )
        VALUES %s
        ON CONFLICT (project_id, user_id, stakeholder_role)
        DO UPDATE SET
            approval_required = EXCLUDED.approval_required,
            active = true
    """
    bulk_insert(conn, sql, rows, "project_stakeholders")
