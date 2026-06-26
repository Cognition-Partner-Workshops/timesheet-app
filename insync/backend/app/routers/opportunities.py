"""Sample opportunity endpoints (read-only browse of the dataset)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..data_layer import get_store


router = APIRouter(prefix="/api", tags=["opportunities"])


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


@router.get("/opportunities/{opportunity_id}")
def get_opportunity(opportunity_id: str) -> dict:
    store = get_store()
    for opp in store.all_opportunities():
        if opp["opportunity_id"] == opportunity_id:
            return _jsonable(opp)
    raise HTTPException(status_code=404, detail="Opportunity not found")
