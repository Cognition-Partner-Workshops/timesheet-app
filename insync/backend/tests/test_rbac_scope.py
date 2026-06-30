"""Unit tests: RBAC scope denial returns the exact required strings per role."""
from __future__ import annotations

from app import chat
from app.auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER
from app.user_context import UserContext


def _ctx(role: str, accounts=None) -> UserContext:
    return UserContext(
        user_id="u1",
        user_name="Test",
        user_role=role,
        accessible_projects=[],
        accessible_accounts=accounts or [],
        accessible_employees=[],
        scope_all=(role == ROLE_PLANNER),
    )


def test_planner_has_no_scope_denial():
    assert chat.rbac_scope_denial("Show the enterprise bench and supply", _ctx(ROLE_PLANNER)) is None


def test_delivery_enterprise_query_denied_with_exact_string():
    denial = chat.rbac_scope_denial("Show me the whole bench across the company", _ctx(ROLE_DELIVERY))
    assert denial == "You do not have permission to access information outside your assigned projects."


def test_delivery_bench_query_denied():
    denial = chat.rbac_scope_denial("What is the bench supply this quarter?", _ctx(ROLE_DELIVERY))
    assert denial == "You do not have permission to access information outside your assigned projects."


def test_client_enterprise_query_denied_with_exact_string():
    denial = chat.rbac_scope_denial("Show internal utilization across all teams", _ctx(ROLE_CLIENT))
    assert denial == (
        "You do not have permission to access opportunities outside your assigned "
        "customer accounts."
    )


def test_client_internal_bench_denied():
    denial = chat.rbac_scope_denial("Who is on the bench?", _ctx(ROLE_CLIENT))
    assert denial == (
        "You do not have permission to access opportunities outside your assigned "
        "customer accounts."
    )


def test_delivery_in_scope_question_allowed():
    assert chat.rbac_scope_denial("What is the skill gap for my project role?", _ctx(ROLE_DELIVERY)) is None
