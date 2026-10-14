"""Load confirmed/current allocations from Allocations."""

from __future__ import annotations

from typing import Dict

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, to_date, to_float


def upsert_allocations(conn, sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str], project_map: Dict[str, str], config: AppConfig):
    allocations_df = get_sheet(sheets, "Allocations")
    rows = []

    for row in df_records(allocations_df):
        employee_code = clean_text(row.get("Employee_ID"))
        employee_id = employee_map.get(employee_code)
        if not employee_id:
            continue

        external_project_code = clean_text(row.get("ProjectID"))
        project_id = project_map.get(external_project_code)

        source_key = clean_text(row.get("Allocation_ID"))
        if not source_key:
            source_key = f"ALLOC:{employee_code}:{external_project_code}:{to_date(row.get('StartDate'))}:{to_date(row.get('PlannedEndDate'))}"

        rows.append((
            source_key,
            employee_id,
            project_id,
            None,
            external_project_code,
            clean_text(row.get("Project_Name")),
            clean_text(row.get("Client_Name")),
            clean_text(row.get("RoleOnProject")),
            to_float(row.get("AllocationFTE")),
            to_date(row.get("StartDate")),
            to_date(row.get("PlannedEndDate")),
            clean_text(row.get("AllocationStatus")),
            "EXCEL_ALLOCATIONS",
            Json(sanitize_payload(row, config.store_raw_pii)),
        ))

    sql = """
        INSERT INTO allocations (
            source_key,
            employee_id,
            project_id,
            role_id,
            external_project_code,
            external_project_name,
            client_name,
            role_name,
            allocated_fte,
            start_date,
            end_date,
            allocation_status,
            source,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            project_id = EXCLUDED.project_id,
            role_id = EXCLUDED.role_id,
            external_project_code = EXCLUDED.external_project_code,
            external_project_name = EXCLUDED.external_project_name,
            client_name = EXCLUDED.client_name,
            role_name = EXCLUDED.role_name,
            allocated_fte = EXCLUDED.allocated_fte,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            allocation_status = EXCLUDED.allocation_status,
            source = EXCLUDED.source,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, rows, "allocations")
