"""Mock EWA (Engagement / Workforce Allocation) approval endpoints.

The brief requires preserving EWA as the *final approval process* but the MVP
must NOT actually book anyone. Submissions are stored in an in-memory list and
echoed back with a success message - no source data is mutated.

A submitted proposal carries two independent approval gates (requirement §5):
  * Delivery Fit  - approved / changes requested by the Delivery Manager.
  * Business Fit  - approved / cancelled by the Client Manager.
The overall status is derived from the two gates.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import ROLE_CLIENT, ROLE_DELIVERY, User
from ..rbac import get_current_user, require_roles

router = APIRouter(prefix="/api/ewa", tags=["ewa"])

# In-memory store of mock submissions (reset on restart - demo only).
_MOCK_REQUESTS: list[dict] = []

# Gate states.
_PENDING = "Pending"
_APPROVED = "Approved"
_CHANGES = "Changes Requested"
_CANCELLED = "Cancelled"


def _overall_status(record: dict) -> str:
    """Derive the headline status from the two approval gates."""
    delivery = record["delivery_fit"]["status"]
    business = record["business_fit"]["status"]
    if _CANCELLED in (delivery, business):
        return "Cancelled"
    if _CHANGES in (delivery, business):
        return "Changes Requested"
    if delivery == _APPROVED and business == _APPROVED:
        return "Approved — Ready for EWA Booking"
    return "Pending Approval"


class EWASubmission(BaseModel):
    employee_id: str
    employee_name: str | None = None
    role_name: str | None = None
    option_label: str | None = None
    proposed_start_date: str | None = None
    requested_fte: float = 1.0
    match_score: float | None = None
    notes: str | None = None
    opportunity_summary: str | None = None


class GateAction(BaseModel):
    note: str | None = None


def _find(request_id: str) -> dict:
    for rec in _MOCK_REQUESTS:
        if rec["ewa_request_id"] == request_id:
            return rec
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="EWA request not found."
    )


def _stamp(user: User, note: str | None, state: str) -> dict:
    return {
        "status": state,
        "by": user.full_name,
        "role": user.role,
        "note": note,
        "at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("")
def submit(req: EWASubmission, user: User = Depends(get_current_user)) -> dict:
    """Create a *mock* EWA request. Does not book the employee.

    Workforce Planners and Client Managers can raise a proposal; it then needs
    Delivery-fit and Business-fit sign-off.
    """
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
        "opportunity_summary": req.opportunity_summary,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "submitted_by": user.full_name,
        "booking_owner": "Regional Planner",
        "delivery_fit": {"status": _PENDING, "by": None, "note": None, "at": None},
        "business_fit": {"status": _PENDING, "by": None, "note": None, "at": None},
    }
    record["status"] = _overall_status(record)
    _MOCK_REQUESTS.append(record)
    return {
        "success": True,
        "message": "Recommendation sent to EWA for approval.",
        "request": record,
    }


@router.post("/{request_id}/delivery")
def set_delivery_fit(
    request_id: str,
    body: GateAction,
    approve: bool = True,
    user: User = Depends(require_roles(ROLE_DELIVERY)),
) -> dict:
    """Delivery Manager approves delivery fit or requests changes."""
    rec = _find(request_id)
    rec["delivery_fit"] = _stamp(user, body.note, _APPROVED if approve else _CHANGES)
    rec["status"] = _overall_status(rec)
    return {"success": True, "request": rec}


@router.post("/{request_id}/business")
def set_business_fit(
    request_id: str,
    body: GateAction,
    approve: bool = True,
    user: User = Depends(require_roles(ROLE_CLIENT)),
) -> dict:
    """Client Manager approves business fit or cancels the proposal."""
    rec = _find(request_id)
    rec["business_fit"] = _stamp(user, body.note, _APPROVED if approve else _CANCELLED)
    rec["status"] = _overall_status(rec)
    return {"success": True, "request": rec}


@router.get("")
def list_requests(user: User = Depends(get_current_user)) -> dict:
    """Return all mock EWA requests submitted this session (newest first)."""
    return {"requests": list(reversed(_MOCK_REQUESTS)), "role": user.role}
