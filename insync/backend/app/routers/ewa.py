"""Mock EWA (Engagement / Workforce Allocation) approval endpoints.

The brief requires preserving EWA as the *final approval process* but the MVP
must NOT actually book anyone. Submissions are stored in an in-memory list and
echoed back with a success message - no source data is mutated.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/ewa", tags=["ewa"])

# In-memory store of mock submissions (reset on restart - demo only).
_MOCK_REQUESTS: list[dict] = []


class EWASubmission(BaseModel):
    employee_id: str
    employee_name: str | None = None
    role_name: str | None = None
    option_label: str | None = None
    proposed_start_date: str | None = None
    requested_fte: float = 1.0
    match_score: float | None = None
    notes: str | None = None


@router.post("")
def submit(req: EWASubmission) -> dict:
    """Create a *mock* EWA request. Does not book the employee."""
    record = {
        "ewa_request_id": f"MOCK-EWA-{uuid.uuid4().hex[:8].upper()}",
        "employee_id": req.employee_id,
        "employee_name": req.employee_name,
        "role_name": req.role_name,
        "option_label": req.option_label,
        "proposed_start_date": req.proposed_start_date,
        "requested_fte": req.requested_fte,
        "match_score": req.match_score,
        "notes": req.notes,
        "status": "Pending Approval",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "booking_owner": "Regional Planner",
    }
    _MOCK_REQUESTS.append(record)
    return {
        "success": True,
        "message": "Recommendation sent to EWA for approval.",
        "request": record,
    }


@router.get("")
def list_requests() -> dict:
    """Return all mock EWA requests submitted this session (newest first)."""
    return {"requests": list(reversed(_MOCK_REQUESTS))}
