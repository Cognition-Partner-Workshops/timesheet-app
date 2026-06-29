"""Load employee skills from the Skills sheet."""

from __future__ import annotations

from typing import Dict

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, to_date, to_float, to_int


def upsert_employee_skills(conn, sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str], config: AppConfig):
    skills = get_sheet(sheets, "Skills")
    rows = []

    for row in df_records(skills):
        employee_code = clean_text(row.get("Employee_ID"))
        employee_id = employee_map.get(employee_code)
        skill_name = clean_text(row.get("SkillName"))
        if not employee_id or not skill_name:
            continue

        source_key = clean_text(row.get("Skill_Row_ID"))
        if not source_key:
            source_key = f"SKILL:{employee_code}:{skill_name}:{clean_text(row.get('EvidenceSource'))}:{to_date(row.get('LastUsedDate'))}"

        rows.append((
            source_key,
            employee_id,
            skill_name,
            clean_text(row.get("SkillCategory")),
            to_int(row.get("SkillLevel")),
            to_float(row.get("YearsExperience")),
            to_date(row.get("LastUsedDate")),
            clean_text(row.get("EvidenceSource")),
            clean_text(row.get("Confidence")),
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    sql = """
        INSERT INTO employee_skills (
            source_key,
            employee_id,
            skill_name,
            skill_category,
            skill_level,
            years_experience,
            last_used_date,
            evidence_source,
            confidence,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            skill_name = EXCLUDED.skill_name,
            skill_category = EXCLUDED.skill_category,
            skill_level = EXCLUDED.skill_level,
            years_experience = EXCLUDED.years_experience,
            last_used_date = EXCLUDED.last_used_date,
            evidence_source = EXCLUDED.evidence_source,
            confidence = EXCLUDED.confidence,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, rows, "employee_skills")
