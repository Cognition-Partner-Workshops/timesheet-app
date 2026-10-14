"""Dashboard metrics endpoint.

Aggregates the supply-side picture the workforce planner needs at a glance:
headcount by availability cohort, roll-off windows, bench risk, and a 12-week
supply forecast derived from the Bench Movement sheet.
"""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends

from ..rbac import require_planner
from ..data_layer import (
    CAT_ALLOCATED,
    CAT_BENCH,
    CAT_PARTIAL,
    CAT_ROLL_30,
    CAT_ROLL_60,
    CAT_ROLL_90,
    get_store,
)

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", dependencies=[Depends(require_planner)])
def dashboard() -> dict:
    store = get_store()
    employees = store.all_employees()

    cat_counts = Counter(e.get("availability_category") for e in employees)
    booked = sum(
        1
        for e in employees
        if (e.get("ewa_status") or "").strip().lower() == "booked"
    )

    # Bench risk distribution (from canonical Bench records).
    bench_risk = Counter(
        (b.get("bench_risk") or "Unknown")
        for b in store._bench_by_emp.values()  # noqa: SLF001 - internal index
    )

    # Breakdowns for richer dashboard cards.
    by_department = Counter(e.get("department") for e in employees)
    by_region = Counter(e.get("region") for e in employees)
    bench_by_discipline = Counter(
        e.get("discipline")
        for e in employees
        if e.get("availability_category") == CAT_BENCH
    )

    forecast = [
        {
            "week_start": row["week_start"].isoformat(),
            "current_bench": row["current_bench"],
            "emerging_bench": row["emerging_bench"],
            "partial_capacity": row["partial_capacity"],
            "available_fte": row["available_fte"],
        }
        for row in store.bench_movement_series()
    ]

    return {
        "snapshot_date": store.snapshot_date.isoformat(),
        "metrics": {
            "total_employees": len(employees),
            "bench": cat_counts.get(CAT_BENCH, 0),
            "partial_capacity": cat_counts.get(CAT_PARTIAL, 0),
            "rolling_off_30": cat_counts.get(CAT_ROLL_30, 0),
            "rolling_off_60": cat_counts.get(CAT_ROLL_60, 0),
            "rolling_off_61_90": cat_counts.get(CAT_ROLL_90, 0),
            "allocated_over_90": cat_counts.get(CAT_ALLOCATED, 0),
            "booked": booked,
        },
        "bench_risk": dict(bench_risk),
        "by_department": dict(by_department.most_common()),
        "by_region": dict(by_region.most_common()),
        "bench_by_discipline": dict(bench_by_discipline.most_common()),
        "supply_forecast": forecast,
    }
