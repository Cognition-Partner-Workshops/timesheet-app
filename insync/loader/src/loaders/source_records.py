"""Preserve reference/unmapped sheets without creating extra operational tables."""

from __future__ import annotations

from typing import Dict, Iterable

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.security.pii import sanitize_payload
from src.utils import df_records

# Sheets not directly mapped to the operational schema but still useful for traceability.
UNMAPPED_SHEETS = {
    "README",
    "Dataset Summary",
    "Data Dictionary",
    "Skill Catalog",
    "Bench Movement",
    "Scenario Targets",
    "Starter Prompts",
    "Change Log",
    "Validation Summary",
}


def preserve_unmapped_sheets(conn, sheets: Dict[str, pd.DataFrame], config: AppConfig):
    rows = []
    for sheet_name, df in sheets.items():
        if sheet_name not in UNMAPPED_SHEETS:
            continue
        for index, row in enumerate(df_records(df), start=2):
            source_key = f"{sheet_name}:{index}"
            rows.append((sheet_name, index, source_key, Json(sanitize_payload(row, config.store_raw_pii))))

    sql = """
        INSERT INTO source_records (
            sheet_name,
            row_number,
            source_key,
            payload
        )
        VALUES %s
        ON CONFLICT (source_key)
        DO UPDATE SET
            sheet_name = EXCLUDED.sheet_name,
            row_number = EXCLUDED.row_number,
            payload = EXCLUDED.payload,
            imported_at = now()
    """
    bulk_insert(conn, sql, rows, "source_records")
