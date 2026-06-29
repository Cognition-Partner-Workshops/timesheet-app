"""Role-based access control helpers (FastAPI dependencies)."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from . import auth
from .auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER, User


def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> User:
    """Resolve the bearer token to a user, or raise 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    user = auth.get_store().get_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user"
        )
    return user


def require_roles(*roles: str):
    """Dependency factory enforcing that the caller holds one of ``roles``."""

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted for your role.",
            )
        return user

    return _dep


# Dashboard analytics are Workforce-Planner-only (requirement §6, §8).
require_planner = require_roles(ROLE_PLANNER)


# --------------------------------------------------------------------------- #
# Chatbot intent permissions                                                   #
# --------------------------------------------------------------------------- #
# Only the Workforce Planner sees org-wide supply / bench analytics. Delivery
# and Client managers work opportunity-by-opportunity, so broad "show the whole
# bench" style questions are gently redirected for them.
ANALYTICS_ROLES = {ROLE_PLANNER}


def can_view_bench_analytics(role: str) -> bool:
    return role in ANALYTICS_ROLES
