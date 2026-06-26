"""Staffing options generator.

Turns a parsed opportunity (a list of :class:`RoleRequirement`) into three
distinct, evidence-backed staffing options. The deterministic scoring engine
selects every candidate here; AI (see ai.py) only narrates the result.

    Option 1 - Best overall match   : highest weighted score per role.
    Option 2 - Fastest availability : earliest start, then score.
    Option 3 - Lowest risk / balanced: prefers fully-available, fully-skilled,
                                       not-booked, high-confidence candidates.
"""
from __future__ import annotations

from datetime import date
from typing import Callable

from . import scoring
from .scoring import RoleRequirement


def _confidence_rank(conf: str) -> int:
    return {"High": 0, "Medium": 1, "Low": 2}.get(conf, 3)


def _risk_penalty(c: dict) -> float:
    """Lower is better. Used by the lowest-risk strategy."""
    penalty = 0.0
    avail = c["availability_detail"]
    if not avail["covers_start"]:
        penalty += 40
    penalty += avail["days_late"] * 0.2
    penalty += len(c["skill_detail"]["missing_required"]) * 12
    if c["ewa_status"] and c["ewa_status"].lower().startswith("booked") and "release" not in c["ewa_status"].lower():
        penalty += 50
    penalty += _confidence_rank(c["confidence"]) * 10
    return penalty


# Strategy = (key label, sort function returning a sort key for a candidate).
STRATEGIES: dict[str, tuple[str, str, Callable[[dict], tuple]]] = {
    "best_match": (
        "Best overall match",
        "Strongest weighted capability + availability score per role.",
        lambda c: (-c["overall_score"],),
    ),
    "fastest": (
        "Fastest availability",
        "Optimised to start as early as possible, then by match quality.",
        lambda c: (
            c["availability_detail"]["days_until_available"],
            -c["overall_score"],
        ),
    ),
    "lowest_risk": (
        "Lowest risk / balanced team",
        "Prefers fully-available, fully-skilled, low-risk candidates.",
        lambda c: (_risk_penalty(c), -c["overall_score"]),
    ),
}


def _eligible(c: dict, strategy: str) -> bool:
    """Filter out candidates a strategy should never surface."""
    booked = (
        c["ewa_status"]
        and c["ewa_status"].lower().startswith("booked")
        and "release" not in c["ewa_status"].lower()
        and "partial" not in c["ewa_status"].lower()
    )
    # Booked people are excluded from the fast/low-risk teams entirely, and only
    # appear as low-confidence stretch options in best-match.
    if booked and strategy != "best_match":
        return False
    return True


def build_options(
    employees: list[dict],
    requirements: list[RoleRequirement],
    snapshot: date,
) -> dict:
    """Return the three staffing options plus the per-role candidate pools."""
    # Pre-score every employee against every role once.
    role_pools: list[dict] = []
    for req in requirements:
        ranked = scoring.rank_candidates(employees, req, snapshot, limit=25)
        role_pools.append({"requirement": req, "candidates": ranked})

    options = []
    for key, (label, description, sort_fn) in STRATEGIES.items():
        assigned_ids: set[str] = set()
        assignments = []
        for pool in role_pools:
            req: RoleRequirement = pool["requirement"]
            candidates = [
                c
                for c in pool["candidates"]
                if c["employee_id"] not in assigned_ids and _eligible(c, key)
            ]
            candidates = sorted(candidates, key=sort_fn)
            picks = candidates[: max(req.count, 1)]
            for pick in picks:
                assigned_ids.add(pick["employee_id"])
            assignments.append(
                {
                    "role_name": req.role_name,
                    "fte_required": req.fte_required,
                    "count_required": req.count,
                    "required_skills": req.required_skills,
                    "desired_skills": req.desired_skills,
                    "candidates": picks,
                    "unfilled": max(req.count - len(picks), 0),
                }
            )

        scores = [
            cand["overall_score"]
            for a in assignments
            for cand in a["candidates"]
        ]
        team_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        soonest = _team_start(assignments)
        options.append(
            {
                "key": key,
                "label": label,
                "description": description,
                "team_score": team_score,
                "team_confidence": _team_confidence(assignments),
                "earliest_team_start": soonest,
                "assignments": assignments,
            }
        )

    return {
        "options": options,
        "role_pools": [
            {
                "role_name": p["requirement"].role_name,
                "candidates": p["candidates"][:10],
            }
            for p in role_pools
        ],
    }


def _team_start(assignments: list[dict]):
    dates = [
        cand["availability_detail"]["earliest_available_date"]
        for a in assignments
        for cand in a["candidates"]
        if cand["availability_detail"].get("earliest_available_date")
    ]
    return max(dates) if dates else None


def _team_confidence(assignments: list[dict]) -> str:
    confs = [
        cand["confidence"] for a in assignments for cand in a["candidates"]
    ]
    if not confs:
        return "Low"
    worst = max(_confidence_rank(c) for c in confs)
    return {0: "High", 1: "Medium", 2: "Low", 3: "Low"}[worst]
