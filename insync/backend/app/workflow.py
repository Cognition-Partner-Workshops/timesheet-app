"""Multi-role staffing-proposal workflow, persisted to PostgreSQL.

This module implements the end-to-end workflow described in the requirement doc
on top of the loader's existing schema:

    Client Manager creates opportunity         -> projects (Pending Staffing)
    Planner creates a staffing proposal         -> staffing_proposals
                                                   + proposal_candidates
    Delivery Manager reviews (approve/changes)  -> proposal_reviews (delivery_fit)
    Client Manager reviews (approve/cancel)     -> proposal_reviews (business_fit)
    Both approved                               -> Ready for EWA
    Submit to EWA                               -> EWA Booked (excluded from
                                                   future recommendations)

A lightweight, role-targeted notification ledger (``tb_notifications``) backs the
in-app notification bell.

Everything degrades gracefully: if Postgres is unavailable the functions return
empty results / raise a clear error so the rest of the app keeps working.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from . import config
from .auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Status lifecycle (requirement §11)                                          #
# --------------------------------------------------------------------------- #
PENDING_STAFFING = "Pending Staffing"
PENDING_DELIVERY = "Pending Delivery Review"
PENDING_CLIENT = "Pending Client Approval"
READY_EWA = "Ready for EWA"
EWA_BOOKED = "EWA Booked"
CHANGES_REQUESTED = "Changes Requested"
CANCELLED = "Cancelled"

# Map the app's auth role -> the DB users.default_role enum.
_APP_TO_DB_ROLE = {
    ROLE_PLANNER: "WORKFORCE_PLANNER",
    ROLE_DELIVERY: "DELIVERY_MANAGER",
    ROLE_CLIENT: "CLIENT_MANAGER",
}

_notif_table_ready = False


def _connect():
    if not config.PG_ENABLED:
        return None
    try:
        import psycopg2
    except ImportError:  # pragma: no cover
        logger.warning("psycopg2 not installed; workflow persistence disabled")
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
        logger.warning("Could not connect to PostgreSQL for workflow: %s", exc)
        return None


def _dict_cursor(conn):
    import psycopg2.extras

    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# --------------------------------------------------------------------------- #
# Lookups                                                                      #
# --------------------------------------------------------------------------- #
def _db_user_for_role(cur, app_role: str) -> Optional[dict]:
    db_role = _APP_TO_DB_ROLE.get(app_role)
    if not db_role:
        return None
    cur.execute(
        "SELECT user_id, full_name FROM users "
        "WHERE default_role = %s AND active ORDER BY created_at LIMIT 1;",
        (db_role,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _employee_uuid(cur, code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    cur.execute(
        "SELECT employee_id FROM employees WHERE employee_code = %s LIMIT 1;",
        (code,),
    )
    row = cur.fetchone()
    return str(row["employee_id"]) if row else None


def _role_id_for(cur, project_id: str, role_name: Optional[str]) -> Optional[str]:
    if not role_name:
        return None
    cur.execute(
        "SELECT role_id FROM project_roles "
        "WHERE project_id = %s AND role_name = %s ORDER BY created_at LIMIT 1;",
        (project_id, role_name),
    )
    row = cur.fetchone()
    return str(row["role_id"]) if row else None


def _ensure_stakeholder(cur, project_id: str, user_id: str, db_role: str) -> str:
    """Return a stakeholder_id for (project, user, role), creating it if needed."""
    cur.execute(
        "SELECT stakeholder_id FROM project_stakeholders "
        "WHERE project_id = %s AND user_id = %s AND stakeholder_role = %s LIMIT 1;",
        (project_id, user_id, db_role),
    )
    row = cur.fetchone()
    if row:
        return str(row["stakeholder_id"])
    cur.execute(
        "INSERT INTO project_stakeholders (project_id, user_id, stakeholder_role, "
        "approval_required, active) VALUES (%s, %s, %s, true, true) "
        "RETURNING stakeholder_id;",
        (project_id, user_id, db_role),
    )
    return str(cur.fetchone()["stakeholder_id"])


# --------------------------------------------------------------------------- #
# Notifications                                                                #
# --------------------------------------------------------------------------- #
def _ensure_notifications(cur) -> None:
    global _notif_table_ready
    if _notif_table_ready:
        return
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tb_notifications (
            notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            target_role text NOT NULL,
            title       text NOT NULL,
            body        text,
            link_type   text,
            link_id     text,
            is_read     boolean NOT NULL DEFAULT false,
            created_at  timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tb_notifications_role "
        "ON tb_notifications (target_role, is_read);"
    )
    _notif_table_ready = True


def _notify(
    cur,
    app_role: str,
    title: str,
    body: Optional[str] = None,
    link_type: Optional[str] = None,
    link_id: Optional[str] = None,
) -> None:
    _ensure_notifications(cur)
    cur.execute(
        "INSERT INTO tb_notifications (target_role, title, body, link_type, link_id) "
        "VALUES (%s, %s, %s, %s, %s);",
        (app_role, title, body, link_type, link_id),
    )


def notify(
    app_role: str,
    title: str,
    body: Optional[str] = None,
    link_type: Optional[str] = None,
    link_id: Optional[str] = None,
) -> bool:
    """Public helper to raise a single role-targeted notification."""
    conn = _connect()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            _notify(cur, app_role, title, body, link_type, link_id)
        conn.commit()
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not create notification: %s", exc)
        return False
    finally:
        conn.close()


def list_notifications(app_role: str, limit: int = 30) -> dict[str, Any]:
    conn = _connect()
    if conn is None:
        return {"notifications": [], "unread": 0}
    try:
        with _dict_cursor(conn) as cur:
            _ensure_notifications(cur)
            cur.execute(
                "SELECT notification_id, title, body, link_type, link_id, is_read, "
                "created_at FROM tb_notifications WHERE target_role = %s "
                "ORDER BY created_at DESC LIMIT %s;",
                (app_role, limit),
            )
            rows = cur.fetchall()
            cur.execute(
                "SELECT count(*) AS n FROM tb_notifications "
                "WHERE target_role = %s AND NOT is_read;",
                (app_role,),
            )
            unread = cur.fetchone()["n"]
        conn.commit()
        items = []
        for r in rows:
            items.append(
                {
                    "id": str(r["notification_id"]),
                    "title": r["title"],
                    "body": r["body"],
                    "link_type": r["link_type"],
                    "link_id": r["link_id"],
                    "is_read": r["is_read"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                }
            )
        return {"notifications": items, "unread": int(unread)}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not list notifications: %s", exc)
        return {"notifications": [], "unread": 0}
    finally:
        conn.close()


def mark_notification_read(notification_id: str, app_role: str) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            _ensure_notifications(cur)
            cur.execute(
                "UPDATE tb_notifications SET is_read = true "
                "WHERE notification_id = %s AND target_role = %s;",
                (notification_id, app_role),
            )
        conn.commit()
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not mark notification read: %s", exc)
        return False
    finally:
        conn.close()


def mark_all_read(app_role: str) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            _ensure_notifications(cur)
            cur.execute(
                "UPDATE tb_notifications SET is_read = true "
                "WHERE target_role = %s AND NOT is_read;",
                (app_role,),
            )
        conn.commit()
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not mark all notifications read: %s", exc)
        return False
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Queues                                                                       #
# --------------------------------------------------------------------------- #
def _roles_for_project(cur, project_id: str) -> list[dict]:
    cur.execute(
        "SELECT role_name, required_fte, grade_preference, required_skills "
        "FROM project_roles WHERE project_id = %s ORDER BY role_code;",
        (project_id,),
    )
    out = []
    for r in cur.fetchall():
        out.append(
            {
                "role_name": r["role_name"],
                "count": int(r["required_fte"]) if r["required_fte"] is not None else 1,
                "grade_preference": r["grade_preference"],
                "required_skills": list(r["required_skills"] or []),
            }
        )
    return out


def _project_card(cur, row: dict) -> dict:
    payload = row.get("raw_payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = {}
    return {
        "project_id": str(row["project_id"]),
        "project_code": row["project_code"],
        "title": row["project_name"],
        "domain": row["domain"],
        "region": row["region"],
        "country": row["country"],
        "city": row["city"],
        "status": row["project_status"],
        "expected_start_date": row["expected_start_date"].isoformat()
        if row.get("expected_start_date")
        else None,
        "duration_weeks": row.get("duration_weeks"),
        "description": payload.get("description"),
        "created_by": payload.get("created_by"),
        "roles": _roles_for_project(cur, str(row["project_id"])),
    }


def pending_staffing() -> list[dict]:
    """Opportunities awaiting candidate recommendations (Planner queue)."""
    conn = _connect()
    if conn is None:
        return []
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM projects WHERE project_status = %s "
                "ORDER BY created_at DESC;",
                (PENDING_STAFFING,),
            )
            rows = cur.fetchall()
            return [_project_card(cur, r) for r in rows]
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not load pending-staffing queue: %s", exc)
        return []
    finally:
        conn.close()


def _decisions_for(cur, proposal_id: str) -> dict[str, dict]:
    cur.execute(
        "SELECT reviewer_role, decision, comment, reviewed_at "
        "FROM proposal_reviews WHERE proposal_id = %s;",
        (proposal_id,),
    )
    out: dict[str, dict] = {}
    for r in cur.fetchall():
        out[r["reviewer_role"]] = {
            "decision": r["decision"],
            "comment": r["comment"],
            "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
        }
    return out


def _proposal_summary(cur, row: dict) -> dict:
    proposal_id = str(row["proposal_id"])
    cur.execute(
        "SELECT count(*) AS n FROM proposal_candidates WHERE proposal_id = %s;",
        (proposal_id,),
    )
    n_candidates = cur.fetchone()["n"]
    cur.execute("SELECT * FROM projects WHERE project_id = %s;", (row["project_id"],))
    proj_row = cur.fetchone()
    project = _project_card(cur, proj_row) if proj_row else {}
    return {
        "proposal_id": proposal_id,
        "project_id": str(row["project_id"]),
        "proposal_status": row["proposal_status"],
        "ai_summary": row["ai_summary"],
        "planner_note": row["planner_note"],
        "selected_option_label": row["selected_option_label"],
        "created_by": row.get("created_by_name"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "candidate_count": int(n_candidates),
        "project": project,
        "reviews": _decisions_for(cur, proposal_id),
    }


def proposals_by_status(statuses: list[str]) -> list[dict]:
    conn = _connect()
    if conn is None:
        return []
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT sp.*, u.full_name AS created_by_name FROM staffing_proposals sp "
                "LEFT JOIN users u ON u.user_id = sp.created_by_user_id "
                "WHERE sp.proposal_status = ANY(%s) ORDER BY sp.created_at DESC;",
                (statuses,),
            )
            rows = cur.fetchall()
            return [_proposal_summary(cur, r) for r in rows]
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not load proposals: %s", exc)
        return []
    finally:
        conn.close()


def all_proposals() -> list[dict]:
    conn = _connect()
    if conn is None:
        return []
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT sp.*, u.full_name AS created_by_name FROM staffing_proposals sp "
                "LEFT JOIN users u ON u.user_id = sp.created_by_user_id "
                "ORDER BY sp.created_at DESC;"
            )
            rows = cur.fetchall()
            return [_proposal_summary(cur, r) for r in rows]
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not load proposals: %s", exc)
        return []
    finally:
        conn.close()


def get_proposal(proposal_id: str) -> Optional[dict]:
    """Full proposal detail incl. candidate scorecards (for reviewers)."""
    conn = _connect()
    if conn is None:
        return None
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT sp.*, u.full_name AS created_by_name FROM staffing_proposals sp "
                "LEFT JOIN users u ON u.user_id = sp.created_by_user_id "
                "WHERE sp.proposal_id = %s;",
                (proposal_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            summary = _proposal_summary(cur, row)
            cur.execute(
                "SELECT raw_payload, proposed_fte, fit_score, candidate_workflow_status, "
                "ewa_status FROM proposal_candidates WHERE proposal_id = %s "
                "ORDER BY created_at;",
                (proposal_id,),
            )
            candidates = []
            for c in cur.fetchall():
                payload = c["raw_payload"] or {}
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except ValueError:
                        payload = {}
                candidates.append(
                    {
                        "candidate": payload.get("candidate"),
                        "role_name": payload.get("role_name"),
                        "option_label": payload.get("option_label"),
                        "proposed_start": payload.get("proposed_start"),
                        "proposed_fte": float(c["proposed_fte"])
                        if c["proposed_fte"] is not None
                        else None,
                        "fit_score": float(c["fit_score"])
                        if c["fit_score"] is not None
                        else None,
                        "workflow_status": c["candidate_workflow_status"],
                        "ewa_status": c["ewa_status"],
                    }
                )
            summary["candidates"] = candidates
            return summary
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not load proposal: %s", exc)
        return None
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Mutations                                                                    #
# --------------------------------------------------------------------------- #
def _set_status(cur, project_id: str, proposal_id: Optional[str], status: str) -> None:
    cur.execute(
        "UPDATE projects SET project_status = %s, updated_at = now() WHERE project_id = %s;",
        (status, project_id),
    )
    if proposal_id:
        cur.execute(
            "UPDATE staffing_proposals SET proposal_status = %s, updated_at = now() "
            "WHERE proposal_id = %s;",
            (status, proposal_id),
        )


def create_proposal(
    *,
    planner_app_role: str,
    project_id: str,
    candidates: list[dict],
    ai_summary: Optional[str] = None,
    planner_note: Optional[str] = None,
    option_label: Optional[str] = None,
) -> dict:
    """Persist a staffing proposal + its candidates; advance the project status."""
    if not candidates:
        raise RuntimeError("Select at least one candidate before creating a proposal.")
    conn = _connect()
    if conn is None:
        raise RuntimeError("PostgreSQL is not available; cannot create proposal.")
    try:
        with _dict_cursor(conn) as cur:
            planner = _db_user_for_role(cur, planner_app_role)
            planner_uid = planner["user_id"] if planner else None
            cur.execute("SELECT project_code FROM projects WHERE project_id = %s;", (project_id,))
            prow = cur.fetchone()
            if not prow:
                raise RuntimeError("Opportunity not found.")
            source_key = "PROP-" + project_id[:8]
            cur.execute(
                "INSERT INTO staffing_proposals (source_key, project_id, created_by_user_id, "
                "proposal_status, selected_option_label, ai_summary, planner_note) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING proposal_id;",
                (
                    source_key + "-" + str(_now_suffix()),
                    project_id,
                    planner_uid,
                    PENDING_DELIVERY,
                    option_label,
                    ai_summary,
                    planner_note,
                ),
            )
            proposal_id = str(cur.fetchone()["proposal_id"])

            for item in candidates:
                cand = item.get("candidate") or {}
                emp_uuid = _employee_uuid(cur, cand.get("employee_id"))
                role_id = _role_id_for(cur, project_id, item.get("role_name"))
                cur.execute(
                    "INSERT INTO proposal_candidates (proposal_id, role_id, employee_id, "
                    "proposed_fte, proposed_start_date, fit_score, risk_level, reason_codes, "
                    "candidate_workflow_status, ewa_status, raw_payload) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);",
                    (
                        proposal_id,
                        role_id,
                        emp_uuid,
                        item.get("proposed_fte") or 1.0,
                        item.get("proposed_start") or None,
                        cand.get("overall_score"),
                        cand.get("confidence"),
                        list(cand.get("risks") or [])[:5],
                        "Proposed",
                        "Pending",
                        json.dumps(item),
                    ),
                )

            _set_status(cur, project_id, proposal_id, PENDING_DELIVERY)
            _notify(
                cur,
                ROLE_DELIVERY,
                "New staffing proposal ready for review",
                f"{prow['project_code']} — {len(candidates)} candidate(s) proposed.",
                "proposal",
                proposal_id,
            )
        conn.commit()
        return {"proposal_id": proposal_id, "status": PENDING_DELIVERY}
    except Exception as exc:
        conn.rollback()
        logger.warning("Could not create proposal: %s", exc)
        raise RuntimeError(f"Could not create proposal: {exc}") from exc
    finally:
        conn.close()


def _now_suffix() -> int:
    import time

    return int(time.time() * 1000)


def record_review(
    *,
    proposal_id: str,
    reviewer_app_role: str,
    review_type: str,  # "delivery_fit" | "business_fit"
    decision: str,  # "APPROVED" | "CHANGES" | "REJECTED" | "CANCELLED"
    comment: Optional[str] = None,
) -> dict:
    """Record a delivery/business review and advance the workflow accordingly."""
    if decision != "APPROVED" and not (comment and comment.strip()):
        raise RuntimeError("A comment is required when not approving.")
    conn = _connect()
    if conn is None:
        raise RuntimeError("PostgreSQL is not available; cannot record review.")
    db_role = _APP_TO_DB_ROLE[reviewer_app_role]
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT sp.*, p.project_code FROM staffing_proposals sp "
                "JOIN projects p ON p.project_id = sp.project_id "
                "WHERE sp.proposal_id = %s;",
                (proposal_id,),
            )
            sp = cur.fetchone()
            if not sp:
                raise RuntimeError("Proposal not found.")
            project_id = str(sp["project_id"])
            project_code = sp["project_code"]

            reviewer = _db_user_for_role(cur, reviewer_app_role)
            if not reviewer:
                raise RuntimeError("No reviewer account is configured for this role.")
            stakeholder_id = _ensure_stakeholder(
                cur, project_id, reviewer["user_id"], db_role
            )
            cur.execute(
                "INSERT INTO proposal_reviews (proposal_id, stakeholder_id, reviewer_user_id, "
                "reviewer_role, decision, comment, reviewed_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, now()) "
                "ON CONFLICT (proposal_id, stakeholder_id) DO UPDATE SET "
                "decision = EXCLUDED.decision, comment = EXCLUDED.comment, "
                "reviewed_at = now();",
                (proposal_id, stakeholder_id, reviewer["user_id"], db_role, decision, comment),
            )

            new_status = _advance(cur, proposal_id, project_id, project_code, review_type, decision)
        conn.commit()
        return {"proposal_id": proposal_id, "status": new_status}
    except Exception as exc:
        conn.rollback()
        logger.warning("Could not record review: %s", exc)
        raise RuntimeError(f"Could not record review: {exc}") from exc
    finally:
        conn.close()


def _advance(cur, proposal_id, project_id, project_code, review_type, decision) -> str:
    """Compute and persist the next status; emit notifications."""
    if review_type == "delivery_fit":
        if decision == "APPROVED":
            _set_status(cur, project_id, proposal_id, PENDING_CLIENT)
            _notify(
                cur, ROLE_CLIENT, "Proposal awaiting business approval",
                f"{project_code} — delivery fit approved; please review business fit.",
                "proposal", proposal_id,
            )
            return PENDING_CLIENT
        status = CHANGES_REQUESTED if decision == "CHANGES" else CANCELLED
        _set_status(cur, project_id, proposal_id, status)
        _notify(
            cur, ROLE_PLANNER,
            "Delivery requested changes" if decision == "CHANGES" else "Delivery rejected proposal",
            f"{project_code} — see the Delivery Manager's comment.",
            "proposal", proposal_id,
        )
        return status

    # business_fit
    if decision == "APPROVED":
        _set_status(cur, project_id, proposal_id, READY_EWA)
        _notify(
            cur, ROLE_PLANNER, "Proposal approved — ready for EWA",
            f"{project_code} — both gates approved. Submit to EWA when ready.",
            "proposal", proposal_id,
        )
        _notify(
            cur, ROLE_DELIVERY, "Proposal approved by client",
            f"{project_code} — ready for EWA booking.", "proposal", proposal_id,
        )
        return READY_EWA
    status = CHANGES_REQUESTED if decision == "CHANGES" else CANCELLED
    _set_status(cur, project_id, proposal_id, status)
    label = "Client requested changes" if decision == "CHANGES" else "Client cancelled proposal"
    _notify(cur, ROLE_PLANNER, label, f"{project_code} — see the Client Manager's comment.",
            "proposal", proposal_id)
    _notify(cur, ROLE_DELIVERY, label, f"{project_code} — see the Client Manager's comment.",
            "proposal", proposal_id)
    return status


def submit_to_ewa(proposal_id: str, *, actor_app_role: str) -> dict:
    """Final EWA booking: mark candidates booked, exclude from future recs."""
    conn = _connect()
    if conn is None:
        raise RuntimeError("PostgreSQL is not available; cannot submit to EWA.")
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT sp.*, p.project_code FROM staffing_proposals sp "
                "JOIN projects p ON p.project_id = sp.project_id "
                "WHERE sp.proposal_id = %s;",
                (proposal_id,),
            )
            sp = cur.fetchone()
            if not sp:
                raise RuntimeError("Proposal not found.")
            if sp["proposal_status"] != READY_EWA:
                raise RuntimeError(
                    "Proposal is not ready for EWA (needs both approvals first)."
                )
            project_id = str(sp["project_id"])
            cur.execute(
                "UPDATE proposal_candidates SET ewa_status = %s, "
                "candidate_workflow_status = %s, updated_at = now() "
                "WHERE proposal_id = %s;",
                ("EWA Booked", "Booked", proposal_id),
            )
            _set_status(cur, project_id, proposal_id, EWA_BOOKED)
            for role in (ROLE_PLANNER, ROLE_DELIVERY, ROLE_CLIENT):
                _notify(
                    cur, role, "EWA booking confirmed",
                    f"{sp['project_code']} — team booked; excluded from future recommendations.",
                    "proposal", proposal_id,
                )
        conn.commit()
        return {"proposal_id": proposal_id, "status": EWA_BOOKED}
    except Exception as exc:
        conn.rollback()
        logger.warning("Could not submit to EWA: %s", exc)
        raise RuntimeError(f"Could not submit to EWA: {exc}") from exc
    finally:
        conn.close()


def booked_employee_codes() -> set[str]:
    """Employee codes (e.g. EMP-001) already booked through a completed EWA."""
    conn = _connect()
    if conn is None:
        return set()
    try:
        with _dict_cursor(conn) as cur:
            cur.execute(
                "SELECT DISTINCT e.employee_code FROM proposal_candidates pc "
                "JOIN employees e ON e.employee_id = pc.employee_id "
                "WHERE pc.ewa_status = %s AND e.employee_code IS NOT NULL;",
                ("EWA Booked",),
            )
            return {r["employee_code"] for r in cur.fetchall()}
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not read booked employees: %s", exc)
        return set()
    finally:
        conn.close()
