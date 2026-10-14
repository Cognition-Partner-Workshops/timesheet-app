"""Load imported EWA rows into proposal workflow tables."""

from __future__ import annotations

import logging
from typing import Dict

import pandas as pd
from psycopg2.extras import Json, RealDictCursor

from src.config import AppConfig
from src.db import bulk_insert, fetch_one
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, to_date, to_float

logger = logging.getLogger(__name__)


def derive_candidate_workflow_status(ewa_status: str | None) -> str:
    text = (ewa_status or "").upper()
    if "BOOK" in text:
        return "BOOKED"
    if "BLOCK" in text:
        return "BLOCKED"
    if "PENDING" in text:
        return "PENDING_APPROVAL"
    if "APPROV" in text:
        return "APPROVED"
    if "DRAFT" in text:
        return "DRAFT"
    return "IMPORTED"


def upsert_imported_ewa(
    conn,
    sheets: Dict[str, pd.DataFrame],
    employee_map: Dict[str, str],
    project_map: Dict[str, str],
    role_map: Dict[str, str],
    config: AppConfig,
):
    ewa_df = get_sheet(sheets, "EWA Requests")
    if ewa_df.empty:
        logger.info("EWA Requests: no rows to import")
        return

    planner = fetch_one(conn, "SELECT user_id FROM users WHERE default_role = 'WORKFORCE_PLANNER' ORDER BY created_at LIMIT 1")
    planner_user_id = planner["user_id"] if planner else None

    project_codes = sorted({clean_text(row.get("Opportunity_ID")) for row in df_records(ewa_df) if clean_text(row.get("Opportunity_ID"))})
    proposal_rows = []

    for project_code in project_codes:
        project_id = project_map.get(project_code)
        if not project_id:
            continue
        proposal_rows.append((
            f"IMPORTED_EWA:{project_code}",
            project_id,
            planner_user_id,
            "IMPORTED_EWA",
            "Imported EWA Requests",
            None,
            "Imported from Excel EWA Requests sheet.",
        ))

    proposal_sql = """
        INSERT INTO staffing_proposals (
            source_key,
            project_id,
            created_by_user_id,
            proposal_status,
            selected_option_label,
            ai_summary,
            planner_note
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            project_id = EXCLUDED.project_id,
            created_by_user_id = EXCLUDED.created_by_user_id,
            proposal_status = EXCLUDED.proposal_status,
            selected_option_label = EXCLUDED.selected_option_label,
            ai_summary = EXCLUDED.ai_summary,
            planner_note = EXCLUDED.planner_note,
            updated_at = now()
    """
    bulk_insert(conn, proposal_sql, proposal_rows, "staffing_proposals from EWA")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT source_key, proposal_id FROM staffing_proposals WHERE source_key LIKE 'IMPORTED_EWA:%'")
        proposal_map = {row["source_key"]: row["proposal_id"] for row in cur.fetchall()}

    candidate_rows = []

    for row in df_records(ewa_df):
        ewa_code = clean_text(row.get("EWA_Request_ID"))
        project_code = clean_text(row.get("Opportunity_ID"))
        role_code = clean_text(row.get("Opportunity_Role_ID"))
        employee_code = clean_text(row.get("Employee_ID"))

        proposal_id = proposal_map.get(f"IMPORTED_EWA:{project_code}")
        employee_id = employee_map.get(employee_code)
        role_id = role_map.get(role_code)

        if not proposal_id or not employee_id:
            continue

        ewa_status = clean_text(row.get("EWAStatus"))
        workflow_status = derive_candidate_workflow_status(ewa_status)
        risk_level = "HIGH" if workflow_status == "BLOCKED" else None
        source_key = ewa_code or f"EWA:{project_code}:{role_code}:{employee_code}:{to_date(row.get('ProposedStartDate'))}"

        reason_codes = []
        if workflow_status:
            reason_codes.append(f"EWA_{workflow_status}")
        if to_float(row.get("FTEGap"), 0.0) and to_float(row.get("FTEGap"), 0.0) > 0:
            reason_codes.append("FTE_GAP")
        if clean_text(row.get("BlockingReason")):
            reason_codes.append("HAS_BLOCKING_REASON")

        candidate_rows.append((
            source_key,
            ewa_code,
            proposal_id,
            role_id,
            employee_id,
            to_float(row.get("RequestedFTE")),
            to_date(row.get("ProposedStartDate")),
            to_date(row.get("ProposedEndDate")),
            None,
            None,
            risk_level,
            reason_codes,
            workflow_status,
            ewa_status,
            clean_text(row.get("BlockingReason")),
            clean_text(row.get("NextAction")),
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    candidate_sql = """
        INSERT INTO proposal_candidates (
            source_key,
            external_ewa_code,
            proposal_id,
            role_id,
            employee_id,
            proposed_fte,
            proposed_start_date,
            proposed_end_date,
            fit_score,
            risk_score,
            risk_level,
            reason_codes,
            candidate_workflow_status,
            ewa_status,
            blocking_reason,
            next_action,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            external_ewa_code = EXCLUDED.external_ewa_code,
            proposal_id = EXCLUDED.proposal_id,
            role_id = EXCLUDED.role_id,
            employee_id = EXCLUDED.employee_id,
            proposed_fte = EXCLUDED.proposed_fte,
            proposed_start_date = EXCLUDED.proposed_start_date,
            proposed_end_date = EXCLUDED.proposed_end_date,
            fit_score = EXCLUDED.fit_score,
            risk_score = EXCLUDED.risk_score,
            risk_level = EXCLUDED.risk_level,
            reason_codes = EXCLUDED.reason_codes,
            candidate_workflow_status = EXCLUDED.candidate_workflow_status,
            ewa_status = EXCLUDED.ewa_status,
            blocking_reason = EXCLUDED.blocking_reason,
            next_action = EXCLUDED.next_action,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, candidate_sql, candidate_rows, "proposal_candidates from EWA")

    create_reviews_for_imported_ewa(conn)


def create_reviews_for_imported_ewa(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT proposal_id, project_id FROM staffing_proposals WHERE source_key LIKE 'IMPORTED_EWA:%'")
        proposals = cur.fetchall()
        rows = []
        for proposal in proposals:
            cur.execute(
                """
                SELECT stakeholder_id, user_id, stakeholder_role
                FROM project_stakeholders
                WHERE project_id = %s
                  AND approval_required = true
                  AND active = true
                """,
                (proposal["project_id"],),
            )
            for stakeholder in cur.fetchall():
                rows.append((
                    proposal["proposal_id"],
                    stakeholder["stakeholder_id"],
                    stakeholder["user_id"],
                    stakeholder["stakeholder_role"],
                    "PENDING",
                    None,
                    None,
                ))

    sql = """
        INSERT INTO proposal_reviews (
            proposal_id,
            stakeholder_id,
            reviewer_user_id,
            reviewer_role,
            decision,
            comment,
            reviewed_at
        )
        VALUES %s
        ON CONFLICT (proposal_id, stakeholder_id)
        DO NOTHING
    """
    bulk_insert(conn, sql, rows, "proposal_reviews")
