"""Load employees from People and related sheets."""

from __future__ import annotations

from typing import Dict

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.loaders.workbook import collect_employee_codes
from src.security.crypto import encrypt_text, hash_for_lookup
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, make_employee_token


def upsert_employees(conn, sheets: Dict[str, pd.DataFrame], config: AppConfig):
    people = get_sheet(sheets, "People")
    all_codes = collect_employee_codes(sheets)
    rows_by_code = {}

    for row in df_records(people):
        employee_code = clean_text(row.get("Employee_ID"))
        if not employee_code:
            continue

        token = make_employee_token(employee_code)
        employee_name = clean_text(row.get("Employee_Name")) or f"Candidate {token}"

        rows_by_code[employee_code] = (
            employee_code,
            token,
            encrypt_text(employee_name, config.fernet_key),
            hash_for_lookup(employee_name, config.name_hash_salt),
            clean_text(row.get("Region")),
            clean_text(row.get("Country")),
            clean_text(row.get("City")),
            clean_text(row.get("Timezone")),
            clean_text(row.get("Department")),
            clean_text(row.get("Discipline")),
            clean_text(row.get("RoleArchetype")),
            clean_text(row.get("Grade")),
            clean_text(row.get("CareerLevel")),
            clean_text(row.get("PrimaryDomain")),
            clean_text(row.get("SecondaryDomain")),
            clean_text(row.get("WorkMode")),
            "ACTIVE",
            Json(sanitize_payload(row, config.store_raw_pii)),
        )

    # Create placeholder employees for rows referenced outside People.
    for employee_code in all_codes:
        if employee_code not in rows_by_code:
            token = make_employee_token(employee_code)
            display_name = f"Candidate {token}"
            rows_by_code[employee_code] = (
                employee_code,
                token,
                encrypt_text(display_name, config.fernet_key),
                hash_for_lookup(display_name, config.name_hash_salt),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "IMPORTED_PLACEHOLDER",
                Json({"placeholder": True, "employee_code": employee_code}),
            )

    sql = """
        INSERT INTO employees (
            employee_code,
            employee_token,
            employee_name_encrypted,
            employee_name_hash,
            region,
            country,
            city,
            timezone,
            department,
            discipline,
            role_archetype,
            grade,
            career_level,
            primary_domain,
            secondary_domain,
            work_mode,
            employee_status,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (employee_code)
        DO UPDATE SET
            employee_token = EXCLUDED.employee_token,
            employee_name_encrypted = EXCLUDED.employee_name_encrypted,
            employee_name_hash = EXCLUDED.employee_name_hash,
            region = EXCLUDED.region,
            country = EXCLUDED.country,
            city = EXCLUDED.city,
            timezone = EXCLUDED.timezone,
            department = EXCLUDED.department,
            discipline = EXCLUDED.discipline,
            role_archetype = EXCLUDED.role_archetype,
            grade = EXCLUDED.grade,
            career_level = EXCLUDED.career_level,
            primary_domain = EXCLUDED.primary_domain,
            secondary_domain = EXCLUDED.secondary_domain,
            work_mode = EXCLUDED.work_mode,
            employee_status = EXCLUDED.employee_status,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, list(rows_by_code.values()), "employees")
