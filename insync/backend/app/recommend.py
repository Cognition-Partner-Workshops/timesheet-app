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

from . import config, rag, scoring
from .scoring import RoleRequirement

# Expand the location search only when the current level yields no eligible
# candidate (configurable). Keeping this at 1 honours the rule that an exact
# city with matching people is never diluted by other locations.
_MIN_CANDIDATES = max(getattr(config, "RECOMMEND_MIN_CANDIDATES", 1), 1)

_REGION_LABEL = {
    "city": "city",
    "country": "country",
    "region": "region",
    "remote": "remote-eligible workforce",
    "global": "global workforce",
}


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
    # Pre-score every employee against every role once. Only candidates that
    # pass the hard location + required-skill gate are returned here.
    role_pools: list[dict] = []
    for req in requirements:
        pool = scoring.build_role_pool(
            employees,
            req,
            snapshot,
            min_candidates=_MIN_CANDIDATES,
            semantic_fn=rag.semantic_scores_for_tokens,
            limit=25,
        )
        role_pools.append(
            {
                "requirement": req,
                "candidates": pool["candidates"],
                "location_level": pool["location_level"],
                "location_penalty": pool["location_penalty"],
                "fallback": pool["fallback"],
                "no_skill_match": pool["no_skill_match"],
            }
        )

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
            unfilled = max(req.count - len(picks), 0)
            assignments.append(
                {
                    "role_name": req.role_name,
                    "fte_required": req.fte_required,
                    "count_required": req.count,
                    "required_skills": req.required_skills,
                    "desired_skills": req.desired_skills,
                    "candidates": picks,
                    "unfilled": unfilled,
                    "unfilled_reason": (
                        _unfilled_reason(req, pool) if unfilled else None
                    ),
                    "location_level": pool["location_level"],
                    "location_penalty": pool["location_penalty"],
                    "location_fallback": pool["fallback"],
                    "location_fallback_notice": _fallback_notice(req, pool),
                    "no_strong_match": pool["no_skill_match"],
                    "capability_gap": _capability_gap(req, pool),
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


def _fallback_notice(req: RoleRequirement, pool: dict) -> str | None:
    """UI banner shown when progressive location expansion was triggered."""
    if not pool.get("fallback"):
        return None
    location = (req.location_preference or "").strip()
    level = pool.get("location_level")
    sample = next(
        (c for c in pool.get("candidates", [])), {}
    )
    if level == "country":
        target = sample.get("country") or "the wider country"
    elif level == "region":
        target = (sample.get("region") + " region") if sample.get("region") else "the wider region"
    else:
        target = f"the {_REGION_LABEL.get(level, level)}"
    return (
        f"No suitable candidates found in {location}. "
        f"Recommendations have been expanded to {target}."
    )


def _capability_gap(req: RoleRequirement, pool: dict) -> dict | None:
    """Case 3: no employee anywhere has the required skills -> capability gap."""
    if not pool.get("no_skill_match"):
        return None
    skills = ", ".join(s for s in req.required_skills if s)
    return {
        "headline": "No Strong Internal Match",
        "summary": (
            f"No internal employee currently has the required skill set"
            + (f" ({skills})" if skills else "")
            + ". This represents a capability gap rather than an availability gap."
        ),
        "suggested_next_actions": [
            "Consider reskilling or upskilling an adjacent internal employee.",
            "Consider external sourcing / hiring for this capability.",
            "Consider remote hiring to widen the candidate pool.",
        ],
    }


def _unfilled_reason(req: RoleRequirement, pool: dict | None = None) -> str:
    """Honest message when a role cannot be staffed from eligible candidates."""
    if pool and pool.get("no_skill_match"):
        gap = _capability_gap(req, pool)
        if gap:
            return f"{gap['headline']} — {gap['summary']}"
    location = (req.location_preference or "").strip()
    skills = ", ".join(s for s in req.required_skills if s)
    if location and skills:
        return (
            f"Unfortunately, there aren't any available people for this location "
            f"({location}) and this skill set ({skills})."
        )
    if location:
        return (
            f"Unfortunately, there aren't any available people for this location "
            f"({location})."
        )
    if skills:
        return (
            f"Unfortunately, there aren't any available people with this skill "
            f"set ({skills})."
        )
    return "Unfortunately, there aren't any available people for this role."


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
