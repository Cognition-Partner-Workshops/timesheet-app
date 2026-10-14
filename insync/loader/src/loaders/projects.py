"""Load projects from the Opportunities sheet."""

from __future__ import annotations

from typing import Dict

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.loaders.workbook import collect_project_codes
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, to_date, to_float, to_int


def upsert_projects(conn, sheets: Dict[str, pd.DataFrame], config: AppConfig):
    opportunities = get_sheet(sheets, "Opportunities")
    all_codes = collect_project_codes(sheets)
    rows_by_code = {}

    for row in df_records(opportunities):
        project_code = clean_text(row.get("Opportunity_ID"))
        if not project_code:
            continue
        rows_by_code[project_code] = (
            project_code,
            clean_text(row.get("Opportunity_Name")),
            clean_text(row.get("Client_Name")),
            clean_text(row.get("Client_Type")),
            clean_text(row.get("Region")),
            clean_text(row.get("Country")),
            clean_text(row.get("City")),
            clean_text(row.get("Domain")),
            clean_text(row.get("Stage")),
            to_float(row.get("Probability")),
            clean_text(row.get("CommercialPriority")),
            clean_text(row.get("DeliveryRisk")),
            to_date(row.get("ExpectedStartDate")),
            to_int(row.get("DurationWeeks")),
            clean_text(row.get("TimezonePreference")),
            "OPEN",
            "CLIENT_AND_DELIVERY",
            Json(sanitize_payload(row, config.store_raw_pii)),
        )

    # Preserve references to projects missing from Opportunities.
    for project_code in all_codes:
        if project_code not in rows_by_code:
            rows_by_code[project_code] = (
                project_code,
                f"Imported Project {project_code}",
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
                None,
                "OPEN",
                "CLIENT_AND_DELIVERY",
                Json({"placeholder": True, "project_code": project_code}),
            )

    sql = """
        INSERT INTO projects (
            project_code,
            project_name,
            client_name,
            client_type,
            region,
            country,
            city,
            domain,
            stage,
            probability,
            commercial_priority,
            delivery_risk,
            expected_start_date,
            duration_weeks,
            timezone_preference,
            project_status,
            approval_mode,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (project_code)
        DO UPDATE SET
            project_name = EXCLUDED.project_name,
            client_name = EXCLUDED.client_name,
            client_type = EXCLUDED.client_type,
            region = EXCLUDED.region,
            country = EXCLUDED.country,
            city = EXCLUDED.city,
            domain = EXCLUDED.domain,
            stage = EXCLUDED.stage,
            probability = EXCLUDED.probability,
            commercial_priority = EXCLUDED.commercial_priority,
            delivery_risk = EXCLUDED.delivery_risk,
            expected_start_date = EXCLUDED.expected_start_date,
            duration_weeks = EXCLUDED.duration_weeks,
            timezone_preference = EXCLUDED.timezone_preference,
            project_status = EXCLUDED.project_status,
            approval_mode = EXCLUDED.approval_mode,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, list(rows_by_code.values()), "projects")
