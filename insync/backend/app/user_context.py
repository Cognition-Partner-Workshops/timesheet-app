"""Authenticated user context for the read-only chat assistant.

Every chat request is answered in the context of a ``UserContext`` carrying the
caller's identity and access scope:

    userId, userName, userRole,
    accessibleProjects, accessibleAccounts, accessibleEmployees,
    businessUnit, location.

The Workforce Planner is enterprise-wide (``scope_all``). Delivery Managers and
Client Partners get a deterministic, stable subset of the live data so that
out-of-scope questions can be detected and denied. Scope is derived from the
PostgreSQL-backed DataStore; nothing here mutates data.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from .auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER, User
from .data_layer import get_store


def _seed(user_id: str) -> int:
    digest = hashlib.blake2b(str(user_id).encode("utf-8"), digest_size=4).digest()
    return int.from_bytes(digest, "big")


def _stable_subset(items: list[str], user_id: str) -> list[str]:
    """Deterministic ~half subset of ``items`` for a given user (>=1 when possible)."""
    ordered = sorted({i for i in items if i})
    if not ordered:
        return []
    seed = _seed(user_id)
    chosen = [item for idx, item in enumerate(ordered) if (idx + seed) % 2 == 0]
    return chosen or ordered[:1]


@dataclass
class UserContext:
    user_id: str
    user_name: str
    user_role: str
    accessible_projects: list[str] = field(default_factory=list)
    accessible_accounts: list[str] = field(default_factory=list)
    accessible_employees: list[str] = field(default_factory=list)
    business_unit: str = "Enterprise"
    location: str = ""
    scope_all: bool = False

    def to_dict(self) -> dict:
        return {
            "userId": self.user_id,
            "userName": self.user_name,
            "userRole": self.user_role,
            "accessibleProjects": self.accessible_projects,
            "accessibleAccounts": self.accessible_accounts,
            "accessibleEmployees": self.accessible_employees,
            "businessUnit": self.business_unit,
            "location": self.location,
            "scopeAll": self.scope_all,
        }


def build_context(user: User) -> UserContext:
    """Construct a scoped ``UserContext`` for the authenticated ``user``."""
    try:
        store = get_store()
        opportunities = store.all_opportunities()
        employees = store.all_employees()
    except Exception:  # pragma: no cover - DB unavailable -> minimal context
        opportunities = []
        employees = []

    all_accounts = [o.get("client_name") for o in opportunities if o.get("client_name")]
    all_projects = [o.get("opportunity_id") for o in opportunities if o.get("opportunity_id")]
    all_employees = [e.get("employee_id") for e in employees if e.get("employee_id")]

    if user.role == ROLE_PLANNER:
        # Enterprise-wide visibility.
        return UserContext(
            user_id=user.id,
            user_name=user.full_name,
            user_role=user.role,
            accessible_projects=sorted(set(all_projects)),
            accessible_accounts=sorted(set(all_accounts)),
            accessible_employees=sorted(set(all_employees)),
            business_unit="Enterprise",
            location="",
            scope_all=True,
        )

    if user.role == ROLE_DELIVERY:
        projects = _stable_subset(all_projects, user.id)
        proj_set = set(projects)
        accounts = sorted(
            {
                o.get("client_name")
                for o in opportunities
                if o.get("opportunity_id") in proj_set and o.get("client_name")
            }
        )
        regions = [
            o.get("region")
            for o in opportunities
            if o.get("opportunity_id") in proj_set and o.get("region")
        ]
        emps = sorted(
            {
                e.get("employee_id")
                for e in employees
                if e.get("current_project_id") and e.get("current_project_id") in proj_set
            }
        )
        return UserContext(
            user_id=user.id,
            user_name=user.full_name,
            user_role=user.role,
            accessible_projects=sorted(proj_set),
            accessible_accounts=accounts,
            accessible_employees=emps,
            business_unit=(regions[0] if regions else "Delivery"),
            location="",
            scope_all=False,
        )

    if user.role == ROLE_CLIENT:
        accounts = _stable_subset(all_accounts, user.id)
        acc_set = set(accounts)
        projects = sorted(
            {
                o.get("opportunity_id")
                for o in opportunities
                if o.get("client_name") in acc_set and o.get("opportunity_id")
            }
        )
        return UserContext(
            user_id=user.id,
            user_name=user.full_name,
            user_role=user.role,
            accessible_projects=projects,
            accessible_accounts=sorted(acc_set),
            accessible_employees=[],  # Client Partners never see internal staff.
            business_unit="Client",
            location="",
            scope_all=False,
        )

    # Unknown role -> minimal, no scope.
    return UserContext(
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role,
        scope_all=False,
    )
