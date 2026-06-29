"""In-app notification API (role-targeted, lightweight)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import workflow
from ..auth import User
from ..rbac import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user)) -> dict:
    return workflow.list_notifications(user.role)


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: User = Depends(get_current_user)) -> dict:
    ok = workflow.mark_notification_read(notification_id, user.role)
    return {"success": ok}


@router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user)) -> dict:
    ok = workflow.mark_all_read(user.role)
    return {"success": ok}
