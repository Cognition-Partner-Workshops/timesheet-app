"""Merge Profiles, Project History, Skills summaries, and Opportunity Overlays into employee_evidence."""

from __future__ import annotations

from typing import Dict, List

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.security.pii import replace_employee_name, sanitize_payload
from src.utils import clean_text, df_records, get_sheet, join_non_empty, make_employee_token, to_date, to_float, to_int


def upsert_employee_evidence(
    conn,
    sheets: Dict[str, pd.DataFrame],
    employee_map: Dict[str, str],
    project_map: Dict[str, str],
    role_map: Dict[str, str],
    config: AppConfig,
):
    rows = []

    rows.extend(_profile_evidence(sheets, employee_map, config))
    rows.extend(_project_history_evidence(sheets, employee_map, config))
    rows.extend(_skill_summary_evidence(sheets, employee_map))
    rows.extend(_overlay_evidence(sheets, employee_map, project_map, role_map, config))

    sql = """
        INSERT INTO employee_evidence (
            source_key,
            employee_id,
            project_id,
            role_id,
            evidence_type,
            source_sheet,
            evidence_text,
            score_json,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            project_id = EXCLUDED.project_id,
            role_id = EXCLUDED.role_id,
            evidence_type = EXCLUDED.evidence_type,
            source_sheet = EXCLUDED.source_sheet,
            evidence_text = EXCLUDED.evidence_text,
            score_json = EXCLUDED.score_json,
            raw_payload = EXCLUDED.raw_payload
    """
    bulk_insert(conn, sql, rows, "employee_evidence")


def _profile_evidence(sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str], config: AppConfig) -> List[tuple]:
    profiles_df = get_sheet(sheets, "Profiles")
    rows = []

    for row in df_records(profiles_df):
        employee_code = clean_text(row.get("Employee_ID"))
        employee_id = employee_map.get(employee_code)
        if not employee_id:
            continue

        token = make_employee_token(employee_code)
        employee_name = clean_text(row.get("Employee_Name"))
        evidence_text = join_non_empty([
            replace_employee_name(row.get("ProfileSummary"), employee_name, token),
            f"Key strengths: {replace_employee_name(row.get('KeyStrengths'), employee_name, token)}" if row.get("KeyStrengths") else None,
            f"Preferred work: {replace_employee_name(row.get('PreferredWorkTypes'), employee_name, token)}" if row.get("PreferredWorkTypes") else None,
            f"Domain experience: {replace_employee_name(row.get('DomainExperienceSummary'), employee_name, token)}" if row.get("DomainExperienceSummary") else None,
            f"Certifications: {replace_employee_name(row.get('Certifications'), employee_name, token)}" if row.get("Certifications") else None,
            f"Recent highlights: {replace_employee_name(row.get('RecentHighlights'), employee_name, token)}" if row.get("RecentHighlights") else None,
            f"Mobility: {replace_employee_name(row.get('MobilityNotes'), employee_name, token)}" if row.get("MobilityNotes") else None,
            f"Languages: {replace_employee_name(row.get('Languages'), employee_name, token)}" if row.get("Languages") else None,
        ])

        rows.append((
            f"PROFILE:{employee_code}",
            employee_id,
            None,
            None,
            "PROFILE",
            "Profiles",
            evidence_text,
            Json({}),
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    return rows


def _project_history_evidence(sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str], config: AppConfig) -> List[tuple]:
    history_df = get_sheet(sheets, "Project History")
    rows = []

    for row in df_records(history_df):
        employee_code = clean_text(row.get("Employee_ID"))
        employee_id = employee_map.get(employee_code)
        if not employee_id:
            continue

        token = make_employee_token(employee_code)
        employee_name = clean_text(row.get("Employee_Name"))
        source_key = clean_text(row.get("History_ID")) or f"HISTORY:{employee_code}:{clean_text(row.get('Project_Name'))}:{to_date(row.get('StartDate'))}"
        evidence_text = join_non_empty([
            f"Candidate {token} project history.",
            f"Client type: {clean_text(row.get('Client_Type'))}",
            f"Domain: {clean_text(row.get('Domain'))}",
            f"Role: {clean_text(row.get('Role'))}",
            f"Methods/technologies: {clean_text(row.get('KeyTechnologiesOrMethods'))}",
            f"Responsibilities: {replace_employee_name(row.get('Responsibilities'), employee_name, token)}",
            f"Outcome evidence: {replace_employee_name(row.get('OutcomeEvidence'), employee_name, token)}",
            f"Period: {to_date(row.get('StartDate'))} to {to_date(row.get('EndDate'))}",
            f"Team size: {to_int(row.get('TeamSize'))}",
        ])

        rows.append((
            source_key,
            employee_id,
            None,
            None,
            "PROJECT_HISTORY",
            "Project History",
            evidence_text,
            Json({}),
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    return rows


def _skill_summary_evidence(sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str]) -> List[tuple]:
    skills_df = get_sheet(sheets, "Skills")
    grouped: Dict[str, List[dict]] = {}
    rows = []

    for row in df_records(skills_df):
        employee_code = clean_text(row.get("Employee_ID"))
        if employee_code:
            grouped.setdefault(employee_code, []).append(row)

    for employee_code, skill_rows in grouped.items():
        employee_id = employee_map.get(employee_code)
        if not employee_id:
            continue
        token = make_employee_token(employee_code)
        top_skills = sorted(
            skill_rows,
            key=lambda r: (to_int(r.get("SkillLevel"), 0), to_float(r.get("YearsExperience"), 0.0)),
            reverse=True,
        )[:12]
        skill_text = "; ".join([
            f"{clean_text(r.get('SkillName'))} level {to_int(r.get('SkillLevel'))}, {to_float(r.get('YearsExperience'), 0.0)} yrs, confidence {clean_text(r.get('Confidence'))}"
            for r in top_skills
            if clean_text(r.get("SkillName"))
        ])
        evidence_text = f"Candidate {token} skill summary: {skill_text}"
        rows.append((
            f"SKILL_SUMMARY:{employee_code}",
            employee_id,
            None,
            None,
            "SKILL_SUMMARY",
            "Skills",
            evidence_text,
            Json({"skill_count": len(skill_rows)}),
            Json({"generated_from": "Skills", "employee_code": employee_code}),
        ))

    return rows


def _overlay_evidence(
    sheets: Dict[str, pd.DataFrame],
    employee_map: Dict[str, str],
    project_map: Dict[str, str],
    role_map: Dict[str, str],
    config: AppConfig,
) -> List[tuple]:
    overlays_df = get_sheet(sheets, "Opportunity Overlays")
    rows = []

    for row in df_records(overlays_df):
        employee_code = clean_text(row.get("Employee_ID"))
        employee_id = employee_map.get(employee_code)
        if not employee_id:
            continue

        project_id = project_map.get(clean_text(row.get("Opportunity_ID")))
        role_id = role_map.get(clean_text(row.get("Opportunity_Role_ID")))
        token = make_employee_token(employee_code)
        employee_name = clean_text(row.get("Employee_Name"))
        source_key = clean_text(row.get("Overlay_ID")) or f"OVERLAY:{clean_text(row.get('Opportunity_ID'))}:{clean_text(row.get('Opportunity_Role_ID'))}:{employee_code}"

        score_json = {
            "fit_status": clean_text(row.get("FitStatus")),
            "rank": to_int(row.get("Rank")),
            "match_score": to_float(row.get("MatchScore")),
            "capability_fit_score": to_float(row.get("CapabilityFitScore")),
            "availability_fit_score": to_float(row.get("AvailabilityFitScore")),
            "overall_staffing_score": to_float(row.get("OverallStaffingScore")),
            "required_skills_matched": to_int(row.get("RequiredSkillsMatched")),
            "required_skills_total": to_int(row.get("RequiredSkillsTotal")),
            "desired_skills_matched": to_int(row.get("DesiredSkillsMatched")),
            "desired_skills_total": to_int(row.get("DesiredSkillsTotal")),
            "available_fte_at_start": to_float(row.get("AvailableFTEAtStart")),
            "fte_gap": to_float(row.get("FTEGap")),
        }
        evidence_text = join_non_empty([
            f"Candidate {token} imported opportunity-role overlay.",
            f"Fit status: {clean_text(row.get('FitStatus'))}",
            f"Rank: {to_int(row.get('Rank'))}",
            f"Match score: {to_float(row.get('MatchScore'))}",
            f"Rationale: {replace_employee_name(row.get('Rationale'), employee_name, token)}",
            f"Constraint: {replace_employee_name(row.get('Constraint'), employee_name, token)}",
            f"EWA status: {clean_text(row.get('EWAStatus'))}",
            f"Planner notes: {replace_employee_name(row.get('PlannerNotes'), employee_name, token)}",
        ])

        rows.append((
            source_key,
            employee_id,
            project_id,
            role_id,
            "OVERLAY_RATIONALE",
            "Opportunity Overlays",
            evidence_text,
            Json(score_json),
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    return rows
