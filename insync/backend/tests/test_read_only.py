"""Unit tests: read-only action-intent detection."""
from __future__ import annotations

import pytest

from app import chat


@pytest.mark.parametrize(
    "prompt",
    [
        "Approve the EWA for the banking proposal",
        "Please assign Grace to Project Atlas",
        "create a new opportunity and submit it",
        "delete the proposal candidate",
        "allocate 2 engineers to the team",
        "reject this booking",
        "submit to EWA",
        "generate a proposal for the client",
        "trigger the workflow",
        "modify the database record",
        "update the allocation",
    ],
)
def test_action_prompts_detected(prompt):
    assert chat.is_action_request(prompt) is True


@pytest.mark.parametrize(
    "prompt",
    [
        "Who is on the bench for a React role?",
        "Need 2 backend engineers with Java in Pune",
        "Which candidates have Kubernetes experience?",
        "How do I approve an EWA?",  # process question -> allowed
        "Explain the process for staffing a project",
        "What happens after a candidate is approved?",
    ],
)
def test_non_action_prompts_not_blocked(prompt):
    assert chat.is_action_request(prompt) is False
