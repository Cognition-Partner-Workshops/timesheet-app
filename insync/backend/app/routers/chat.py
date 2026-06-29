"""Role-aware chatbot endpoint (pgvector retrieval + grounded explanation)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import chat, rag
from ..auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER, User
from ..rbac import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


# Suggested prompts surfaced in the UI, tailored per role.
_SUGGESTIONS = {
    ROLE_PLANNER: [
        "Who is on the bench for a React role in Banking?",
        "Find available Java engineers in India starting within 30 days",
        "Which candidates have the lowest delivery risk for a QA role?",
    ],
    ROLE_DELIVERY: [
        "Is there a strong technical fit for a Backend Engineer in Payments?",
        "What are the skill gaps for a DevOps role in MENA?",
        "Show candidates with recent hands-on Kubernetes experience",
    ],
    ROLE_CLIENT: [
        "Which candidates suit a Banking client engagement in the UAE?",
        "What is the business fit for a Project Manager in Healthcare?",
        "Summarise the proposed team for opportunity OPP-001",
    ],
}


@router.get("")
def chat_meta(user: User = Depends(get_current_user)) -> dict:
    return {
        "retrieval_enabled": rag.retrieval_enabled(),
        "suggestions": _SUGGESTIONS.get(user.role, []),
        "role": user.role,
    }


@router.post("")
def chat_ask(req: ChatRequest, user: User = Depends(get_current_user)) -> dict:
    result = chat.answer_question(req.message, user.role)
    return {
        "answer": result.answer,
        "sources": result.sources,
        "retrieval": result.retrieval,
        "used_ai": result.used_ai,
        "restricted": result.restricted,
        "role": result.role,
    }
