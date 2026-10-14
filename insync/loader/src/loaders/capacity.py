"""Build employee_capacity from People, Bench, Partial Capacity, and Availability Calendar."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, List

import pandas as pd
from psycopg2.extras import Json

from src.config import AppConfig
from src.db import bulk_insert
from src.security.pii import sanitize_payload
from src.utils import clean_text, df_records, get_sheet, to_date, to_float, to_int

logger = logging.getLogger(__name__)


def get_reference_date(availability_df: pd.DataFrame, config: AppConfig) -> date:
    if config.reference_date:
        parsed = to_date(config.reference_date)
        if parsed:
            return parsed

    if not availability_df.empty and "WeekStartDate" in availability_df.columns:
        dates = [to_date(row.get("WeekStartDate")) for row in df_records(availability_df)]
        dates = [d for d in dates if d]
        if dates:
            return min(dates)

    return date.today()


def build_availability_timeline(rows: List[dict]) -> List[dict]:
    timeline = []
    for row in rows:
        week_date = to_date(row.get("WeekStartDate"))
        if not week_date:
            continue
        timeline.append({
            "week_start_date": week_date.isoformat(),
            "available_fte": to_float(row.get("AvailableFTE"), 0.0),
            "availability_type": clean_text(row.get("AvailabilityType")),
            "source": clean_text(row.get("Source")),
            "confidence": clean_text(row.get("Confidence")),
            "ewa_status": clean_text(row.get("EWAStatus")),
            "notes": clean_text(row.get("Notes")),
        })
    timeline.sort(key=lambda item: item["week_start_date"])
    return timeline


def max_available_within(timeline: List[dict], reference_date: date, days: int, fallback: float) -> float:
    cutoff = reference_date + timedelta(days=days)
    values = []
    for item in timeline:
        week = to_date(item.get("week_start_date"))
        if week and reference_date <= week <= cutoff:
            values.append(to_float(item.get("available_fte"), 0.0))
    return max(values) if values else fallback


def derive_capacity_status(total_fte: float, allocated_fte: float, reserved_fte: float, available_fte: float, availability_category: str | None) -> str:
    if reserved_fte > 0 and available_fte <= 0:
        return "SOFT_RESERVED"
    if available_fte <= 0:
        category = (availability_category or "").lower()
        if "rolling off" in category:
            return "AVAILABLE_SOON"
        return "NOT_AVAILABLE"
    if available_fte < total_fte:
        return "PARTIALLY_AVAILABLE"
    return "AVAILABLE"


def upsert_employee_capacity(conn, sheets: Dict[str, pd.DataFrame], employee_map: Dict[str, str], config: AppConfig):
    people_df = get_sheet(sheets, "People")
    bench_df = get_sheet(sheets, "Bench")
    partial_df = get_sheet(sheets, "Partial Capacity")
    availability_df = get_sheet(sheets, "Availability Calendar")

    reference_date = get_reference_date(availability_df, config)
    logger.info("Reference date for 30/60/90 availability: %s", reference_date)

    people_by_emp = {clean_text(row.get("Employee_ID")): row for row in df_records(people_df) if clean_text(row.get("Employee_ID"))}
    bench_by_emp = {clean_text(row.get("Employee_ID")): row for row in df_records(bench_df) if clean_text(row.get("Employee_ID"))}
    partial_by_emp = {clean_text(row.get("Employee_ID")): row for row in df_records(partial_df) if clean_text(row.get("Employee_ID"))}

    availability_by_emp: Dict[str, List[dict]] = {}
    for row in df_records(availability_df):
        employee_code = clean_text(row.get("Employee_ID"))
        if employee_code:
            availability_by_emp.setdefault(employee_code, []).append(row)

    rows = []
    for employee_code, employee_id in employee_map.items():
        person_row = people_by_emp.get(employee_code, {})
        bench_row = bench_by_emp.get(employee_code)
        partial_row = partial_by_emp.get(employee_code)

        current_allocation = to_float(person_row.get("CurrentAllocationFTE"), 0.0)
        current_available = to_float(person_row.get("AvailableFTECurrent"), max(1.0 - current_allocation, 0.0))

        total_fte = max(1.0, current_allocation + current_available)
        allocated_fte = current_allocation
        reserved_fte = 0.0
        available_fte = current_available

        availability_category = clean_text(person_row.get("AvailabilityCategory"))
        release_window = clean_text(person_row.get("ReleaseWindow"))
        expected_release_date = to_date(person_row.get("ExpectedReleaseDate"))
        timeline = build_availability_timeline(availability_by_emp.get(employee_code, []))

        available_30d = max_available_within(timeline, reference_date, 30, available_fte)
        available_60d = max_available_within(timeline, reference_date, 60, available_30d)
        available_90d = max_available_within(timeline, reference_date, 90, available_60d)
        capacity_status = derive_capacity_status(total_fte, allocated_fte, reserved_fte, available_fte, availability_category)

        bench_source = bench_row or partial_row or {}
        raw_payload = {
            "people": sanitize_payload(person_row, config.store_raw_pii) if person_row else None,
            "bench": sanitize_payload(bench_row, config.store_raw_pii) if bench_row else None,
            "partial_capacity": sanitize_payload(partial_row, config.store_raw_pii) if partial_row else None,
            "availability_row_count": len(availability_by_emp.get(employee_code, [])),
        }

        rows.append((
            employee_id,
            total_fte,
            allocated_fte,
            reserved_fte,
            available_fte,
            available_30d,
            available_60d,
            available_90d,
            availability_category,
            release_window,
            expected_release_date,
            capacity_status,
            clean_text(bench_source.get("BenchType")),
            clean_text(bench_source.get("BenchRisk")),
            to_int(bench_source.get("TimeOnBenchDays")),
            clean_text(bench_source.get("SuggestedAction")),
            clean_text(bench_source.get("TargetRoleFit")),
            clean_text(bench_source.get("EWAActionRequired")),
            Json(timeline),
            Json(raw_payload),
        ))

    sql = """
        INSERT INTO employee_capacity (
            employee_id,
            total_fte,
            allocated_fte,
            reserved_fte,
            available_fte,
            available_30d_fte,
            available_60d_fte,
            available_90d_fte,
            availability_category,
            release_window,
            expected_release_date,
            capacity_status,
            bench_type,
            bench_risk,
            time_on_bench_days,
            suggested_action,
            target_role_fit,
            ewa_action_required,
            availability_timeline,
            raw_payload
        )
        VALUES %s
        ON CONFLICT (employee_id)
        DO UPDATE SET
            total_fte = EXCLUDED.total_fte,
            allocated_fte = EXCLUDED.allocated_fte,
            reserved_fte = EXCLUDED.reserved_fte,
            available_fte = EXCLUDED.available_fte,
            available_30d_fte = EXCLUDED.available_30d_fte,
            available_60d_fte = EXCLUDED.available_60d_fte,
            available_90d_fte = EXCLUDED.available_90d_fte,
            availability_category = EXCLUDED.availability_category,
            release_window = EXCLUDED.release_window,
            expected_release_date = EXCLUDED.expected_release_date,
            capacity_status = EXCLUDED.capacity_status,
            bench_type = EXCLUDED.bench_type,
            bench_risk = EXCLUDED.bench_risk,
            time_on_bench_days = EXCLUDED.time_on_bench_days,
            suggested_action = EXCLUDED.suggested_action,
            target_role_fit = EXCLUDED.target_role_fit,
            ewa_action_required = EXCLUDED.ewa_action_required,
            availability_timeline = EXCLUDED.availability_timeline,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = now()
    """
    bulk_insert(conn, sql, rows, "employee_capacity")
