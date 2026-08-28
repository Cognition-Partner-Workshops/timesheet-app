"""Load project roles from Opportunity Roles."""

from __future__ import annotations

from typing import Dict

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.loaders.workbook import collect_role_refs
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, parse_skill_array, to_bool, to_date, to_float, to_int


def upsert_project_roles(conn, sheets: Dict[str, pd.DataFrame], project_map: Dict[str, str], config: AppConfig):
    roles_df = get_sheet(sheets, "Opportunity Roles")
    role_refs = collect_role_refs(sheets)
    rows_by_code = {}

    for row in df_records(roles_df):
        role_code = clean_text(row.get("Opportunity_Role_ID"))
        project_code = clean_text(row.get("Opportunity_ID"))
        if not role_code or not project_code:
            continue

        project_id = project_map.get(project_code)
        if not project_id:
            continue

        rows_by_code[role_code] = (
            project_id,
            role_code,
            clean_text(row.get("RoleName")),
            clean_text(row.get("DisciplineOrDepartment")),
            clean_text(row.get("GradePreference")),
            parse_skill_array(row.get("RequiredSkills")),
            parse_skill_array(row.get("DesiredSkills")),
            clean_text(row.get("DomainExperienceRequired")),
            clean_text(row.get("LocationPreference")),
            to_date(row.get("StartDate")),
            to_int(row.get("DurationWeeks")),
            to_float(row.get("FTERequired")),
            to_float(row.get("MinimumIndividualFTE"), 1.0),
            to_bool(row.get("CanCombineCandidates"), False),
            clean_text(row.get("Priority")),
            clean_text(row.get("FlexibilityNotes")),
            "OPEN",
            Json(sanitize_payload(row, config.store_raw_pii)),
        )

    # Preserve role references from overlays or EWA even if missing in Opportunity Roles.
    for role_code, project_code in role_refs.items():
        if role_code in rows_by_code:
            continue
        project_id = project_map.get(project_code)
        if not project_id:
            continue
        rows_by_code[role_code] = (
            project_id,
            role_code,
            f"Imported Role {role_code}",
            None,
            None,
            [],
            [],
            None,
            None,
            None,
            None,
            None,
            1.0,
            False,
            None,
            None,
            "OPEN",
            Json({"placeholder": True, "role_code": role_code, "project_code": project_code}),
        )

    sql = """
        INSERT INTO project_roles (
            project_id,
            role_code,
            role_name,
            discipline,
            grade_preference,
            required_skills,
            desired_skills,
            domain_experience_required,
            location_preference,
            start_date,
            duration_weeks,
            required_fte,
            minimum_individual_fte,
            can_combine_candidates,
            priority,
            flexibility_notes,
            role_status,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (role_code)
        DO UPDATE SET
            project_id = EXCLUDED.project_id,
            role_name = EXCLUDED.role_name,
            discipline = EXCLUDED.discipline,
            grade_preference = EXCLUDED.grade_preference,
            required_skills = EXCLUDED.required_skills,
            desired_skills = EXCLUDED.desired_skills,
            domain_experience_required = EXCLUDED.domain_experience_required,
            location_preference = EXCLUDED.location_preference,
            start_date = EXCLUDED.start_date,
            duration_weeks = EXCLUDED.duration_weeks,
            required_fte = EXCLUDED.required_fte,
            minimum_individual_fte = EXCLUDED.minimum_individual_fte,
            can_combine_candidates = EXCLUDED.can_combine_candidates,
            priority = EXCLUDED.priority,
            flexibility_notes = EXCLUDED.flexibility_notes,
            role_status = EXCLUDED.role_status,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, list(rows_by_code.values()), "project_roles")
