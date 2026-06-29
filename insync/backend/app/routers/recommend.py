"""Opportunity intake: NL parsing + staffing recommendations.

Flow:
    POST /api/parse      -> AI (or mock) turns free text into structured JSON.
    POST /api/recommend  -> deterministic engine ranks people and builds the 3
                            staffing options; AI then explains each result.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import ai, recommend as recommend_engine, workflow
from ..data_layer import get_store
from ..scoring import RoleRequirement

router = APIRouter(prefix="/api", tags=["recommend"])


class ParseRequest(BaseModel):
    text: str = Field(..., description="Natural-language opportunity requirement")


class RoleInput(BaseModel):
    role_name: str
    count: int = 1
    required_skills: list[str] = []
    desired_skills: list[str] = []
    domain: Optional[str] = None
    location_preference: Optional[str] = None
    grade_preference: Optional[str] = None
    fte_required: float = 1.0
    start_date: Optional[str] = None


class RecommendRequest(BaseModel):
    summary: Optional[str] = None
    start_date: Optional[str] = None
    roles: list[RoleInput]


def _parse_date(value: Optional[str], default: date) -> date:
    if not value:
        return default
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return default


@router.post("/parse")
def parse(req: ParseRequest) -> dict:
    """Convert a natural-language requirement into structured role demand."""
    store = get_store()
    return ai.parse_requirement(req.text, store.snapshot_date)


@router.post("/recommend")
def recommend(req: RecommendRequest) -> dict:
    """Score candidates and build three explained staffing options."""
    store = get_store()
    snapshot = store.snapshot_date

    requirements: list[RoleRequirement] = []
    for role in req.roles:
        requirements.append(
            RoleRequirement(
                role_name=role.role_name,
                required_skills=role.required_skills,
                desired_skills=role.desired_skills,
                domain=role.domain,
                location_preference=role.location_preference,
                grade_preference=role.grade_preference,
                start_date=_parse_date(role.start_date or req.start_date, snapshot),
                fte_required=role.fte_required,
                count=max(role.count, 1),
            )
        )

    # Drop anyone already booked via a completed EWA (recorded against the
    # staffing-proposal candidates) so the same person cannot be proposed again.
    booked_ids = workflow.booked_employee_codes()
    available = [e for e in store.all_employees() if e["employee_id"] not in booked_ids]

    result = recommend_engine.build_options(available, requirements, snapshot)

    summary = req.summary or "the requested roles"
    # Attach AI / mock explanations to options and individual candidates.
    for option in result["options"]:
        option["explanation"] = ai.explain_option(option, summary)
        for assignment in option["assignments"]:
            for candidate in assignment["candidates"]:
                candidate["explanation"] = ai.explain_candidate(
                    candidate, assignment["role_name"]
                )
            _serialise_candidate_dates(assignment["candidates"])
        option["earliest_team_start"] = (
            option["earliest_team_start"].isoformat()
            if option.get("earliest_team_start")
            else None
        )

    for pool in result["role_pools"]:
        for candidate in pool["candidates"]:
            candidate["explanation"] = ai.mock_explain_candidate(
                candidate, pool["role_name"]
            )
        _serialise_candidate_dates(pool["candidates"])

    return result


def _serialise_candidate_dates(candidates: list[dict]) -> None:
    """Convert date objects inside availability detail to ISO strings."""
    for c in candidates:
        avail = c.get("availability_detail", {})
        earliest = avail.get("earliest_available_date")
        if isinstance(earliest, date):
            avail["earliest_available_date"] = earliest.isoformat()
