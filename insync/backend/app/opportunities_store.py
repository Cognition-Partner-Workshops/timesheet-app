"""Persist Client-Partner-authored opportunities to PostgreSQL.

An "opportunity" maps onto the core ``projects`` table plus one ``project_roles``
row per requested role. This module also exposes the dropdown option lists used
by the structured Create Opportunity form, sourced from real values already in
the database (with an in-memory fallback so the form still works if Postgres is
down).
"""
from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any, Optional

from . import config

logger = logging.getLogger(__name__)

# Static fallbacks (used only when Postgres is unavailable) so the form is never
# empty in a no-database demo.
_FALLBACK = {
    "regions": ["APAC", "India", "MENA"],
    "countries": [
        "Australia", "Egypt", "India", "Jordan", "Malaysia",
        "Saudi Arabia", "Singapore", "UAE", "Vietnam",
    ],
    "domains": [
        "Banking", "Financial Services", "Insurance", "Payments", "Healthcare",
        "Retail", "Public Sector", "Telecommunications", "Logistics", "Travel",
        "Media", "Energy", "Education", "Internal Platforms", "Legacy Platforms",
    ],
    "grades": [
        "Associate Consultant", "Consultant", "Senior Consultant",
        "Lead Consultant", "Principal Consultant", "Manager", "Senior Manager",
    ],
    "roles": [
        "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
        "QA Analyst", "Performance Test Engineer", "Project Manager",
        "Delivery Manager", "Business Analyst", "Data Engineer", "Data Scientist",
        "Cloud Engineer", "DevOps Engineer", "Product Owner", "Product Manager",
    ],
}


def _connect():
    if not config.PG_ENABLED:
        return None
    try:
        import psycopg2
    except ImportError:  # pragma: no cover
        logger.warning("psycopg2 not installed; opportunity persistence disabled")
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
        logger.warning("Could not connect to PostgreSQL for opportunities: %s", exc)
        return None


# Fixed, fully-literal queries keyed by a logical name. Using constant SQL
# strings (no identifier interpolation) keeps these queries injection-safe.
_DISTINCT_QUERIES: dict[str, str] = {
    "role_archetype": (
        "SELECT DISTINCT role_archetype FROM employees "
        "WHERE role_archetype IS NOT NULL AND role_archetype <> '' ORDER BY 1;"
    ),
    "grade": (
        "SELECT DISTINCT grade FROM employees "
        "WHERE grade IS NOT NULL AND grade <> '' ORDER BY 1;"
    ),
    "primary_domain": (
        "SELECT DISTINCT primary_domain FROM employees "
        "WHERE primary_domain IS NOT NULL AND primary_domain <> '' ORDER BY 1;"
    ),
    "region": (
        "SELECT DISTINCT region FROM employees "
        "WHERE region IS NOT NULL AND region <> '' ORDER BY 1;"
    ),
    "country": (
        "SELECT DISTINCT country FROM employees "
        "WHERE country IS NOT NULL AND country <> '' ORDER BY 1;"
    ),
}


def _distinct(cur, key: str) -> list[str]:
    cur.execute(_DISTINCT_QUERIES[key])
    return [row[0] for row in cur.fetchall()]


def form_options() -> dict[str, list[str]]:
    """Dropdown values for the Create Opportunity form, from live DB values."""
    conn = _connect()
    if conn is None:
        return dict(_FALLBACK)
    try:
        with conn.cursor() as cur:
            roles = _distinct(cur, "role_archetype")
            grades = _distinct(cur, "grade")
            domains = _distinct(cur, "primary_domain")
            regions = _distinct(cur, "region")
            countries = _distinct(cur, "country")
        return {
            "roles": roles or _FALLBACK["roles"],
            "grades": grades or _FALLBACK["grades"],
            "domains": domains or _FALLBACK["domains"],
            "regions": regions or _FALLBACK["regions"],
            "countries": countries or _FALLBACK["countries"],
        }
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not load opportunity form options: %s", exc)
        return dict(_FALLBACK)
    finally:
        conn.close()


def create_opportunity(payload: dict[str, Any]) -> dict[str, Any]:
    """Insert a project + its roles. Returns identifiers and a persisted flag.

    Raises RuntimeError when Postgres is unavailable so the caller can surface a
    clear error (this feature is explicitly DB-backed).
    """
    conn = _connect()
    if conn is None:
        raise RuntimeError("PostgreSQL is not available; cannot save opportunity.")

    project_code = "OPP-" + uuid.uuid4().hex[:8].upper()
    description: Optional[str] = payload.get("description")
    roles: list[dict] = payload.get("roles") or []

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO projects (
                    project_code, project_name, client_type, region, country,
                    city, domain, stage, expected_start_date, duration_weeks,
                    project_status, raw_payload
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING project_id;
                """,
                (
                    project_code,
                    payload.get("title") or project_code,
                    payload.get("client_type"),
                    payload.get("region"),
                    payload.get("country"),
                    payload.get("city"),
                    payload.get("domain"),
                    "OPPORTUNITY",
                    payload.get("expected_start_date"),
                    payload.get("duration_weeks"),
                    "Pending Staffing",
                    _json({
                        "description": description,
                        "created_by": payload.get("created_by"),
                        "source": "client_partner_create_opportunity",
                    }),
                ),
            )
            project_id = cur.fetchone()[0]

            created_roles = 0
            for idx, role in enumerate(roles, start=1):
                cur.execute(
                    """
                    INSERT INTO project_roles (
                        project_id, role_code, role_name, grade_preference,
                        required_skills, location_preference, start_date,
                        required_fte, role_status, raw_payload
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        project_id,
                        f"{project_code}-R{idx}",
                        role.get("role_name"),
                        role.get("grade_preference"),
                        role.get("required_skills") or [],
                        role.get("location_preference"),
                        payload.get("expected_start_date"),
                        role.get("count") or 1,
                        "OPEN",
                        _json({"count": role.get("count") or 1}),
                    ),
                )
                created_roles += 1
        conn.commit()
        _notify_planner(project_code, payload, str(project_id))
        return {
            "project_id": str(project_id),
            "project_code": project_code,
            "roles_created": created_roles,
            "persisted": True,
        }
    except Exception as exc:
        conn.rollback()
        logger.warning("Could not create opportunity: %s", exc)
        raise RuntimeError(f"Could not save opportunity: {exc}") from exc
    finally:
        conn.close()


def _notify_planner(project_code: str, payload: dict, project_id: str) -> None:
    """Tell the Workforce Planner a new opportunity needs staffing (§2)."""
    try:
        from . import workflow
        from .auth import ROLE_PLANNER

        roles = payload.get("roles") or []
        role_bits = ", ".join(
            f"{r.get('count') or 1}× {r.get('role_name')}" for r in roles if r.get("role_name")
        )
        title = payload.get("title") or project_code
        workflow.notify(
            ROLE_PLANNER,
            "New staffing request",
            f"{title} ({project_code}) — {role_bits}" if role_bits else f"{title} ({project_code})",
            "opportunity",
            project_id,
        )
    except Exception as exc:  # pragma: no cover - notifications are best-effort
        logger.warning("Could not notify planner of new opportunity: %s", exc)


def _json(obj: dict) -> str:
    import json

    return json.dumps(obj)
