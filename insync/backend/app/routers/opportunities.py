"""Opportunity endpoints: read-only browse + Client-Partner structured create."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from .. import examples as examples_module
from .. import opportunities_store
from ..auth import ROLE_CLIENT, User
from ..data_layer import get_store
from ..rbac import require_roles


router = APIRouter(prefix="/api", tags=["opportunities"])


@router.get("/opportunities/examples")
def opportunity_examples() -> list[dict]:
    """Demo-safe Opportunity Intake examples, validated against live Postgres.

    Examples 1-3 are generated from real available employees so they always
    return at least one candidate; Example 4 is the intentional capability-gap
    ("No Strong Internal Match") scenario. Deterministic SQL/logic only.
    """
    return examples_module.build_examples()


def _jsonable(opp: dict) -> dict:
    out = dict(opp)
    out["expected_start_date"] = (
        opp["expected_start_date"].isoformat() if opp.get("expected_start_date") else None
    )
    roles = []
    for r in opp.get("roles", []):
        roles.append(
            {**r, "start_date": r["start_date"].isoformat() if r.get("start_date") else None}
        )
    out["roles"] = roles
    return out


@router.get("/opportunities")
def list_opportunities() -> dict:
    store = get_store()
    return {"opportunities": [_jsonable(o) for o in store.all_opportunities()]}


@router.get("/opportunities/form-options")
def opportunity_form_options(
    _user: User = Depends(require_roles(ROLE_CLIENT)),
) -> dict:
    """Dropdown values (roles, grades, domains, regions, countries) for the form."""
    return opportunities_store.form_options()


class OpportunityRoleInput(BaseModel):
    role_name: str
    count: int = Field(1, ge=1)
    grade_preference: Optional[str] = None
    required_skills: list[str] = []
    location_preference: Optional[str] = None


class CreateOpportunityInput(BaseModel):
    title: str
    region: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None
    expected_start_date: Optional[str] = None
    duration_weeks: Optional[int] = Field(None, ge=0)
    roles: list[OpportunityRoleInput] = []


@router.post("/opportunities", status_code=status.HTTP_201_CREATED)
def create_opportunity(
    body: CreateOpportunityInput,
    user: User = Depends(require_roles(ROLE_CLIENT)),
) -> dict:
    """Client Partner creates a structured opportunity, persisted to Postgres."""
    if not body.roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one role is required.",
        )
    payload = body.model_dump()
    payload["created_by"] = user.full_name
    payload["roles"] = [r.model_dump() for r in body.roles]
    try:
        result = opportunities_store.create_opportunity(payload)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return {
        "success": True,
        "message": f"Opportunity {result['project_code']} created.",
        **result,
    }


@router.get("/opportunities/{opportunity_id}")
def get_opportunity(opportunity_id: str) -> dict:
    store = get_store()
    for opp in store.all_opportunities():
        if opp["opportunity_id"] == opportunity_id:
            return _jsonable(opp)
    raise HTTPException(status_code=404, detail="Opportunity not found")
