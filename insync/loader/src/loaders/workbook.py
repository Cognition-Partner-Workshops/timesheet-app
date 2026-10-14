"""Workbook loading and reference discovery."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional, Set

import pandas as pd

from src.utils import clean_text, df_records, get_sheet

logger = logging.getLogger(__name__)


def load_workbook(path: str) -> Dict[str, pd.DataFrame]:
    workbook_path = Path(path)
    if not workbook_path.exists():
        raise FileNotFoundError(f"Excel file not found: {workbook_path}")

    logger.info("Loading workbook: %s", workbook_path)
    sheets = pd.read_excel(workbook_path, sheet_name=None, dtype=object)
    normalized = {name.strip(): df for name, df in sheets.items()}
    logger.info("Loaded %d sheets", len(normalized))
    return normalized


def collect_employee_codes(sheets: Dict[str, pd.DataFrame]) -> Set[str]:
    source_sheets = [
        "People",
        "Skills",
        "Profiles",
        "Allocations",
        "Bench",
        "Partial Capacity",
        "Availability Calendar",
        "Project History",
        "Opportunity Overlays",
        "EWA Requests",
    ]
    codes = set()
    for sheet_name in source_sheets:
        df = get_sheet(sheets, sheet_name)
        if df.empty or "Employee_ID" not in df.columns:
            continue
        for row in df_records(df):
            code = clean_text(row.get("Employee_ID"))
            if code:
                codes.add(code)
    return codes


def collect_project_codes(sheets: Dict[str, pd.DataFrame]) -> Set[str]:
    source_sheets = ["Opportunities", "Opportunity Roles", "Opportunity Overlays", "EWA Requests"]
    codes = set()
    for sheet_name in source_sheets:
        df = get_sheet(sheets, sheet_name)
        if df.empty or "Opportunity_ID" not in df.columns:
            continue
        for row in df_records(df):
            code = clean_text(row.get("Opportunity_ID"))
            if code:
                codes.add(code)
    return codes


def collect_role_refs(sheets: Dict[str, pd.DataFrame]) -> Dict[str, Optional[str]]:
    refs = {}
    for sheet_name in ["Opportunity Roles", "Opportunity Overlays", "EWA Requests"]:
        df = get_sheet(sheets, sheet_name)
        if df.empty or "Opportunity_Role_ID" not in df.columns:
            continue
        for row in df_records(df):
            role_code = clean_text(row.get("Opportunity_Role_ID"))
            project_code = clean_text(row.get("Opportunity_ID"))
            if role_code:
                refs[role_code] = project_code
    return refs
