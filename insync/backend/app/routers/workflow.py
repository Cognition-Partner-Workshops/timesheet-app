"""Staffing-proposal workflow API (role-based queues + reviews)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from .. import workflow
from ..auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER, User
from ..rbac import get_current_user, require_roles

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# --------------------------------------------------------------------------- #
# Queues                                                                       #
# --------------------------------------------------------------------------- #
@router.get("/pending-staffing")
def pending_staffing(_user: User = Depends(require_roles(ROLE_PLANNER))) -> dict:
    """Opportunities awaiting candidate recommendations (Planner)."""
    return {"opportunities": workflow.pending_staffing()}


@router.get("/proposals")
def list_proposals(user: User = Depends(get_current_user)) -> dict:
    """Role-scoped proposal queue.

    * Delivery Manager -> proposals awaiting delivery review.
    * Client Manager   -> proposals awaiting business approval (+ ready for EWA).
    * Workforce Planner -> all proposals they can track end-to-end.
    """
    if user.role == ROLE_DELIVERY:
        items = workflow.proposals_by_status([workflow.PENDING_DELIVERY])
    elif user.role == ROLE_CLIENT:
        items = workflow.proposals_by_status(
            [workflow.PENDING_CLIENT, workflow.READY_EWA, workflow.EWA_BOOKED]
        )
    else:  # planner sees everything
        items = workflow.all_proposals()
    return {"proposals": items, "role": user.role}


@router.get("/proposals/{proposal_id}")
def proposal_detail(
    proposal_id: str, _user: User = Depends(get_current_user)
) -> dict:
    detail = workflow.get_proposal(proposal_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return detail


# --------------------------------------------------------------------------- #
# Create proposal (Planner)                                                    #
# --------------------------------------------------------------------------- #
class ProposalCandidateInput(BaseModel):
    candidate: dict[str, Any]
    role_name: Optional[str] = None
    option_label: Optional[str] = None
    proposed_start: Optional[str] = None
    proposed_fte: float = 1.0


class CreateProposalInput(BaseModel):
    project_id: str
    candidates: list[ProposalCandidateInput]
    ai_summary: Optional[str] = None
    planner_note: Optional[str] = None
    option_label: Optional[str] = None


@router.post("/proposals", status_code=status.HTTP_201_CREATED)
def create_proposal(
    body: CreateProposalInput,
    user: User = Depends(require_roles(ROLE_PLANNER)),
) -> dict:
    if not body.candidates:
        raise HTTPException(status_code=422, detail="Select at least one candidate.")
    try:
        result = workflow.create_proposal(
            planner_app_role=user.role,
            project_id=body.project_id,
            candidates=[c.model_dump() for c in body.candidates],
            ai_summary=body.ai_summary,
            planner_note=body.planner_note,
            option_label=body.option_label,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"success": True, **result}


# --------------------------------------------------------------------------- #
# Reviews                                                                      #
# --------------------------------------------------------------------------- #
class ReviewInput(BaseModel):
    decision: str  # APPROVED | CHANGES | REJECTED | CANCELLED
    comment: Optional[str] = None


def _review(proposal_id, review_type, body, role):
    try:
        return workflow.record_review(
            proposal_id=proposal_id,
            reviewer_app_role=role,
            review_type=review_type,
            decision=body.decision.upper(),
            comment=body.comment,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/proposals/{proposal_id}/delivery-review")
def delivery_review(
    proposal_id: str,
    body: ReviewInput,
    user: User = Depends(require_roles(ROLE_DELIVERY)),
) -> dict:
    return {"success": True, **_review(proposal_id, "delivery_fit", body, user.role)}


@router.post("/proposals/{proposal_id}/business-review")
def business_review(
    proposal_id: str,
    body: ReviewInput,
    user: User = Depends(require_roles(ROLE_CLIENT)),
) -> dict:
    return {"success": True, **_review(proposal_id, "business_fit", body, user.role)}


@router.post("/proposals/{proposal_id}/submit-ewa")
def submit_ewa(
    proposal_id: str,
    user: User = Depends(require_roles(ROLE_PLANNER, ROLE_CLIENT)),
) -> dict:
    try:
        result = workflow.submit_to_ewa(proposal_id, actor_app_role=user.role)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"success": True, **result}
