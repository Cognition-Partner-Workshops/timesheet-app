"""Integration-style tests for the chat flow (read-only, RBAC, evidence-only).

These avoid a live database by stubbing retrieval and the deterministic
candidate lookup, so they exercise the chat *control flow* deterministically.
"""
from __future__ import annotations

import pytest

from app import chat, rag
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


@pytest.fixture(autouse=True)
def _no_candidate_lookup(monkeypatch):
    # Keep tests DB-free: skip the deterministic candidate lookup path.
    monkeypatch.setattr(chat, "_candidate_lookup_answer", lambda q, r: None)


def test_action_prompt_returns_exact_refusal():
    resp = chat.answer_question("Approve the EWA for the proposal", context=_ctx(ROLE_PLANNER))
    assert resp.answer == chat.READ_ONLY_REFUSAL
    assert resp.restricted is True


def test_delivery_enterprise_query_returns_exact_denial():
    resp = chat.answer_question(
        "Show the whole bench across the company", context=_ctx(ROLE_DELIVERY)
    )
    assert resp.answer == chat.DELIVERY_SCOPE_DENIAL
    assert resp.restricted is True


def test_client_cross_scope_query_returns_exact_denial():
    resp = chat.answer_question(
        "Show internal utilization across all teams", context=_ctx(ROLE_CLIENT)
    )
    assert resp.answer == chat.CLIENT_SCOPE_DENIAL
    assert resp.restricted is True


def test_insufficient_evidence_when_no_docs(monkeypatch):
    monkeypatch.setattr(rag, "retrieve", lambda *a, **k: [])
    monkeypatch.setattr(rag, "active_backend", lambda: "none")
    resp = chat.answer_question(
        "What is the capital of France?", context=_ctx(ROLE_PLANNER)
    )
    assert resp.answer == chat.INSUFFICIENT_EVIDENCE
    assert resp.retrieval == "none"


def test_planner_gets_seven_section_answer(monkeypatch):
    docs = [
        rag.RetrievedDoc(
            document_key="d1",
            source_type="candidate_summary",
            source_id="EMP-TOKEN-1",
            content="Strong Java + Spring Boot engineer, currently on the bench.",
            metadata={"employee_token": "EMP-TOKEN-1"},
            score=0.72,
        )
    ]
    monkeypatch.setattr(rag, "retrieve", lambda *a, **k: docs)
    monkeypatch.setattr(rag, "active_backend", lambda: "local-vector")
    resp = chat.answer_question("Who can do Java work?", context=_ctx(ROLE_PLANNER))
    for section in (
        "Executive Summary",
        "Key Findings",
        "Supporting Evidence",
        "Confidence Level",
        "Risks / Constraints",
        "Recommended Next Actions",
        "EWA Considerations",
    ):
        assert section in resp.answer
    assert resp.retrieval == "local-vector"


def test_uuid_internal_ids_are_masked(monkeypatch):
    docs = [
        rag.RetrievedDoc(
            document_key="11111111-2222-3333-4444-555555555555",
            source_type="candidate_summary",
            source_id="x",
            content="Employee 11111111-2222-3333-4444-555555555555 is benched.",
            metadata={},
            score=0.6,
        )
    ]
    monkeypatch.setattr(rag, "retrieve", lambda *a, **k: docs)
    monkeypatch.setattr(rag, "active_backend", lambda: "local-vector")
    resp = chat.answer_question("availability?", context=_ctx(ROLE_PLANNER))
    assert "11111111-2222-3333-4444-555555555555" not in resp.answer
    for src in resp.sources:
        assert "11111111-2222-3333-4444-555555555555" not in src["document_key"]
        assert "11111111-2222-3333-4444-555555555555" not in src["snippet"]
