"""Create masked retrieval documents from the core PostgreSQL tables."""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from psycopg2.extras import Json, RealDictCursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import get_config
from src.db import connect_db, execute_sql_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

SQL_DIR = PROJECT_ROOT / "sql"


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(item) for item in value if item)
    return str(value).strip()


def join_parts(parts: Iterable[str]) -> str:
    return " ".join(part for part in parts if part and part.strip())


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def fetch_rows(conn, query: str) -> List[Dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query)
        return list(cur.fetchall())


def candidate_documents(conn) -> List[Tuple]:
    rows = fetch_rows(
        conn,
        """
        SELECT
            e.employee_id,
            e.employee_code,
            e.employee_token,
            e.region,
            e.country,
            e.city,
            e.department,
            e.discipline,
            e.role_archetype,
            e.grade,
            e.career_level,
            e.primary_domain,
            e.secondary_domain,
            e.work_mode,
            ec.capacity_status,
            ec.availability_category,
            ec.available_fte,
            ec.available_30d_fte,
            ec.available_60d_fte,
            ec.available_90d_fte,
            ec.release_window,
            ec.expected_release_date,
            ec.bench_type,
            ec.bench_risk,
            ec.time_on_bench_days,
            ec.suggested_action,
            ec.target_role_fit,
            COALESCE(string_agg(DISTINCT es.skill_name, ', ' ORDER BY es.skill_name), '') AS skills
        FROM employees e
        LEFT JOIN employee_capacity ec ON ec.employee_id = e.employee_id
        LEFT JOIN employee_skills es ON es.employee_id = e.employee_id
        GROUP BY
            e.employee_id,
            ec.employee_id
        ORDER BY e.employee_token
        """,
    )

    documents = []
    for row in rows:
        content = join_parts(
            [
                f"Candidate {clean(row['employee_token'])}.",
                f"Role archetype: {clean(row['role_archetype'])}.",
                f"Discipline: {clean(row['discipline'])}.",
                f"Grade: {clean(row['grade'])}; career level: {clean(row['career_level'])}.",
                f"Domains: primary {clean(row['primary_domain'])}; secondary {clean(row['secondary_domain'])}.",
                f"Location: {clean(row['region'])}, {clean(row['country'])}, {clean(row['city'])}.",
                f"Work mode: {clean(row['work_mode'])}.",
                f"Skills: {clean(row['skills'])}.",
                f"Capacity status: {clean(row['capacity_status'])}; availability category: {clean(row['availability_category'])}.",
                f"Available FTE now: {clean(row['available_fte'])}; 30d: {clean(row['available_30d_fte'])}; 60d: {clean(row['available_60d_fte'])}; 90d: {clean(row['available_90d_fte'])}.",
                f"Release window: {clean(row['release_window'])}; expected release date: {clean(row['expected_release_date'])}.",
                f"Bench type: {clean(row['bench_type'])}; bench risk: {clean(row['bench_risk'])}; time on bench days: {clean(row['time_on_bench_days'])}.",
                f"Suggested action: {clean(row['suggested_action'])}. Target role fit: {clean(row['target_role_fit'])}.",
            ]
        )
        metadata = {
            "employee_token": row["employee_token"],
            "employee_code": row["employee_code"],
            "document_family": "candidate",
        }
        documents.append(
            (
                f"candidate:{row['employee_id']}",
                "candidate_summary",
                str(row["employee_id"]),
                row["employee_id"],
                None,
                None,
                content,
                Json(metadata),
                content_hash(content),
            )
        )
    return documents


def role_documents(conn) -> List[Tuple]:
    rows = fetch_rows(
        conn,
        """
        SELECT
            p.project_id,
            p.project_code,
            p.project_name,
            p.client_type,
            p.region,
            p.country,
            p.city,
            p.domain,
            p.stage,
            p.probability,
            p.commercial_priority,
            p.delivery_risk,
            p.expected_start_date,
            p.duration_weeks AS project_duration_weeks,
            p.timezone_preference,
            r.role_id,
            r.role_code,
            r.role_name,
            r.discipline,
            r.grade_preference,
            r.required_skills,
            r.desired_skills,
            r.domain_experience_required,
            r.location_preference,
            r.start_date,
            r.duration_weeks,
            r.required_fte,
            r.minimum_individual_fte,
            r.can_combine_candidates,
            r.priority,
            r.flexibility_notes,
            r.role_status
        FROM project_roles r
        JOIN projects p ON p.project_id = r.project_id
        ORDER BY p.project_code, r.role_code
        """,
    )

    documents = []
    for row in rows:
        content = join_parts(
            [
                f"Project {clean(row['project_code'])}: {clean(row['project_name'])}.",
                f"Client type: {clean(row['client_type'])}; domain: {clean(row['domain'])}.",
                f"Location: {clean(row['region'])}, {clean(row['country'])}, {clean(row['city'])}; timezone preference: {clean(row['timezone_preference'])}.",
                f"Stage: {clean(row['stage'])}; probability: {clean(row['probability'])}; commercial priority: {clean(row['commercial_priority'])}; delivery risk: {clean(row['delivery_risk'])}.",
                f"Expected start date: {clean(row['expected_start_date'])}; project duration weeks: {clean(row['project_duration_weeks'])}.",
                f"Role {clean(row['role_code'])}: {clean(row['role_name'])}.",
                f"Role discipline: {clean(row['discipline'])}; grade preference: {clean(row['grade_preference'])}.",
                f"Required skills: {clean(row['required_skills'])}. Desired skills: {clean(row['desired_skills'])}.",
                f"Domain experience required: {clean(row['domain_experience_required'])}; location preference: {clean(row['location_preference'])}.",
                f"Role start date: {clean(row['start_date'])}; duration weeks: {clean(row['duration_weeks'])}; required FTE: {clean(row['required_fte'])}; minimum individual FTE: {clean(row['minimum_individual_fte'])}.",
                f"Can combine candidates: {clean(row['can_combine_candidates'])}; priority: {clean(row['priority'])}; role status: {clean(row['role_status'])}.",
                f"Flexibility notes: {clean(row['flexibility_notes'])}.",
            ]
        )
        metadata = {
            "project_code": row["project_code"],
            "role_code": row["role_code"],
            "document_family": "demand",
        }
        documents.append(
            (
                f"role:{row['role_id']}",
                "project_role_summary",
                str(row["role_id"]),
                None,
                row["project_id"],
                row["role_id"],
                content,
                Json(metadata),
                content_hash(content),
            )
        )
    return documents


def evidence_documents(conn) -> List[Tuple]:
    rows = fetch_rows(
        conn,
        """
        SELECT
            ev.evidence_id,
            ev.source_key,
            ev.employee_id,
            ev.project_id,
            ev.role_id,
            ev.evidence_type,
            ev.source_sheet,
            ev.evidence_text,
            ev.score_json,
            e.employee_token,
            p.project_code,
            r.role_code
        FROM employee_evidence ev
        LEFT JOIN employees e ON e.employee_id = ev.employee_id
        LEFT JOIN projects p ON p.project_id = ev.project_id
        LEFT JOIN project_roles r ON r.role_id = ev.role_id
        WHERE ev.evidence_text IS NOT NULL
          AND length(trim(ev.evidence_text)) > 0
        ORDER BY ev.source_sheet, ev.source_key
        """,
    )

    documents = []
    for row in rows:
        content = join_parts(
            [
                f"Evidence for candidate {clean(row['employee_token'])}.",
                f"Evidence type: {clean(row['evidence_type'])}; source sheet: {clean(row['source_sheet'])}.",
                f"Project: {clean(row['project_code'])}; role: {clean(row['role_code'])}.",
                f"Evidence: {clean(row['evidence_text'])}.",
                f"Scores: {json.dumps(row['score_json'], default=str) if row['score_json'] else ''}.",
            ]
        )
        metadata = {
            "employee_token": row["employee_token"],
            "project_code": row["project_code"],
            "role_code": row["role_code"],
            "evidence_type": row["evidence_type"],
            "source_sheet": row["source_sheet"],
            "document_family": "evidence",
        }
        documents.append(
            (
                f"evidence:{row['evidence_id']}",
                "employee_evidence",
                str(row["evidence_id"]),
                row["employee_id"],
                row["project_id"],
                row["role_id"],
                content,
                Json(metadata),
                content_hash(content),
            )
        )
    return documents


def proposal_documents(conn) -> List[Tuple]:
    rows = fetch_rows(
        conn,
        """
        SELECT
            pc.proposal_candidate_id,
            pc.source_key,
            pc.external_ewa_code,
            pc.proposal_id,
            pc.role_id,
            pc.employee_id,
            pc.proposed_fte,
            pc.proposed_start_date,
            pc.proposed_end_date,
            pc.fit_score,
            pc.risk_score,
            pc.risk_level,
            pc.reason_codes,
            pc.candidate_workflow_status,
            pc.ewa_status,
            pc.blocking_reason,
            pc.next_action,
            sp.proposal_status,
            p.project_id,
            p.project_code,
            p.project_name,
            r.role_code,
            r.role_name,
            e.employee_token
        FROM proposal_candidates pc
        JOIN staffing_proposals sp ON sp.proposal_id = pc.proposal_id
        JOIN projects p ON p.project_id = sp.project_id
        LEFT JOIN project_roles r ON r.role_id = pc.role_id
        LEFT JOIN employees e ON e.employee_id = pc.employee_id
        ORDER BY p.project_code, r.role_code, e.employee_token
        """,
    )

    documents = []
    for row in rows:
        content = join_parts(
            [
                f"Proposal candidate {clean(row['employee_token'])} for project {clean(row['project_code'])}: {clean(row['project_name'])}.",
                f"Role {clean(row['role_code'])}: {clean(row['role_name'])}.",
                f"Proposal status: {clean(row['proposal_status'])}; candidate workflow status: {clean(row['candidate_workflow_status'])}; EWA status: {clean(row['ewa_status'])}.",
                f"Proposed FTE: {clean(row['proposed_fte'])}; proposed start: {clean(row['proposed_start_date'])}; proposed end: {clean(row['proposed_end_date'])}.",
                f"Fit score: {clean(row['fit_score'])}; risk score: {clean(row['risk_score'])}; risk level: {clean(row['risk_level'])}.",
                f"Reason codes: {clean(row['reason_codes'])}.",
                f"Blocking reason: {clean(row['blocking_reason'])}. Next action: {clean(row['next_action'])}.",
            ]
        )
        metadata = {
            "employee_token": row["employee_token"],
            "project_code": row["project_code"],
            "role_code": row["role_code"],
            "external_ewa_code": row["external_ewa_code"],
            "document_family": "proposal",
        }
        documents.append(
            (
                f"proposal_candidate:{row['proposal_candidate_id']}",
                "proposal_candidate",
                str(row["proposal_candidate_id"]),
                row["employee_id"],
                row["project_id"],
                row["role_id"],
                content,
                Json(metadata),
                content_hash(content),
            )
        )
    return documents


def upsert_documents(conn, rows: List[Tuple]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO rag_documents (
                document_key,
                source_type,
                source_id,
                employee_id,
                project_id,
                role_id,
                content_masked,
                metadata,
                content_hash
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (document_key)
            DO UPDATE SET
                source_type = EXCLUDED.source_type,
                source_id = EXCLUDED.source_id,
                employee_id = EXCLUDED.employee_id,
                project_id = EXCLUDED.project_id,
                role_id = EXCLUDED.role_id,
                content_masked = EXCLUDED.content_masked,
                metadata = EXCLUDED.metadata,
                content_hash = EXCLUDED.content_hash,
                updated_at = now()
            """,
            rows,
        )


def main() -> None:
    config = get_config()
    with connect_db(config) as conn:
        execute_sql_file(conn, SQL_DIR / "04_rag_schema.sql")

        documents = []
        documents.extend(candidate_documents(conn))
        documents.extend(role_documents(conn))
        documents.extend(evidence_documents(conn))
        documents.extend(proposal_documents(conn))

        logger.info("Generated %d retrieval documents", len(documents))
        upsert_documents(conn, documents)
        conn.commit()

    print(json.dumps({"rag_documents": len(documents)}, indent=2))


if __name__ == "__main__":
    main()
