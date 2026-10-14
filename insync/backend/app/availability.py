"""Deterministic availability logic.

Translates each employee's ``AvailabilityCategory`` and FTE figures into:

    * the earliest date they can usefully start,
    * the FTE they can offer at a proposed start date,
    * a 0-1 availability fit score for a given role start window.

Mapping (per the hackathon brief / dataset definitions):
    Current Bench    -> available now (snapshot date), full free FTE
    Partial Capacity -> available now but only their free FTE
    Rolling Off 0-30 -> available within 30 days (at ExpectedReleaseDate)
    Rolling Off 31-60-> available within 31-60 days
    Rolling Off 61-90-> available within 61-90 days
    Allocated >90    -> not suitable for near-term roles
    Booked (EWAStatus) -> excluded unless surfaced as a low-confidence stretch
"""
from __future__ import annotations

from datetime import date, timedelta

from .data_layer import (
    CAT_ALLOCATED,
    CAT_BENCH,
    CAT_PARTIAL,
    CAT_ROLL_30,
    CAT_ROLL_60,
    CAT_ROLL_90,
)

# Upper bound of each rolling-off bucket, in days from the snapshot date.
_BUCKET_DAYS = {
    CAT_ROLL_30: 30,
    CAT_ROLL_60: 60,
    CAT_ROLL_90: 90,
}


def earliest_available_date(emp: dict, snapshot: date) -> date:
    """Earliest date an employee can usefully contribute capacity."""
    category = emp.get("availability_category")
    if category in (CAT_BENCH, CAT_PARTIAL):
        bench = emp.get("bench") or {}
        return bench.get("available_from") or snapshot
    release = emp.get("expected_release_date")
    if release:
        return release
    # Fallback when no release date: push to the far end of the bucket.
    days = _BUCKET_DAYS.get(category, 365)
    return snapshot + timedelta(days=days)


def available_fte_at(emp: dict, when: date, snapshot: date) -> float:
    """FTE the employee can offer on the proposed ``when`` date."""
    category = emp.get("availability_category")
    if category == CAT_BENCH:
        return 1.0
    if category == CAT_PARTIAL:
        # Partial capacity people offer their free FTE immediately.
        return float(emp.get("available_fte_current") or 0.0)
    if category == CAT_ALLOCATED:
        # Only free up far in the future; treat as unavailable for near-term.
        return 1.0 if (emp.get("expected_release_date") and when >= emp["expected_release_date"]) else 0.0
    # Rolling-off cohorts: full FTE once released, otherwise nothing.
    release = earliest_available_date(emp, snapshot)
    return 1.0 if when >= release else 0.0


def days_until_available(emp: dict, snapshot: date) -> int:
    """Whole days from the snapshot until the employee frees up (>=0)."""
    delta = (earliest_available_date(emp, snapshot) - snapshot).days
    return max(delta, 0)


def is_booked(emp: dict) -> bool:
    """True when the employee is hard-booked (per EWAStatus source of truth)."""
    status = (emp.get("ewa_status") or "").lower()
    return status.startswith("booked") and "release planned" not in status and "partial" not in status


def availability_fit(emp: dict, required_start: date, required_fte: float, snapshot: date) -> dict:
    """Score how well an employee covers a role's start date and FTE demand.

    Returns a dict with the 0-1 ``score`` plus the supporting evidence used by
    the scoring engine and the UI (available FTE, gap, earliest date, lateness).
    """
    available = available_fte_at(emp, required_start, snapshot)
    earliest = earliest_available_date(emp, snapshot)
    fte_gap = max(required_fte - available, 0.0)

    # Coverage component: how much of the required FTE is met at start.
    coverage = min(available / required_fte, 1.0) if required_fte > 0 else 1.0

    # Timing component: penalise people who only free up after the start date.
    days_late = max((earliest - required_start).days, 0)
    if days_late == 0:
        timing = 1.0
    elif days_late <= 30:
        timing = 0.6
    elif days_late <= 60:
        timing = 0.35
    elif days_late <= 90:
        timing = 0.15
    else:
        timing = 0.0

    # If they can cover the FTE on the day, timing dominates; otherwise blend.
    if coverage >= 1.0:
        score = timing
    else:
        score = round(0.5 * coverage + 0.5 * timing, 4)

    return {
        "score": round(score, 4),
        "available_fte_at_start": round(available, 2),
        "fte_gap": round(fte_gap, 2),
        "earliest_available_date": earliest,
        "days_until_available": days_until_available(emp, snapshot),
        "days_late": days_late,
        "covers_start": fte_gap <= 0.0001,
    }
