"""Role-aware chatbot for TalentBridge.

Flow (requirement §2, §18):

    question -> (RBAC intent check) -> pgvector retrieval -> top masked docs
             -> deterministic OR OpenAI explanation grounded in those docs

Key constraints honoured:
  * pgvector retrieval happens *first*; AI only explains.
  * AI is optional — without an API key a deterministic template answers,
    grounded in the same retrieved documents, so the app always works.
  * The whole database is never sent to the LLM, only the top documents.
  * Answers are framed for the caller's role.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from . import ai, config, rag, rbac
from .auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER

# Words that signal an org-wide supply / bench analytics question (planner-only).
_ANALYTICS_TERMS = {
    "bench", "dashboard", "headcount", "supply", "forecast", "utilisation",
    "utilization", "how many", "total", "roll-off", "rolling off", "report",
}

# Bias retrieval toward the relevant document families per intent.
_CANDIDATE_TYPES = ["candidate_summary", "employee_evidence"]
_DEMAND_TYPES = ["project_role_summary", "project_summary"]
_PROPOSAL_TYPES = ["proposal_candidate"]


@dataclass
class ChatResponse:
    answer: str
    sources: list[dict]
    retrieval: str  # "pgvector" | "fallback" | "none"
    used_ai: bool
    role: str
    restricted: bool = False


def _is_analytics(question: str) -> bool:
    low = question.lower()
    return any(term in low for term in _ANALYTICS_TERMS)


def _intent_source_types(question: str) -> Optional[list[str]]:
    low = question.lower()
    if any(w in low for w in ("proposal", "ewa", "approval", "pending", "booked")):
        return _PROPOSAL_TYPES + _CANDIDATE_TYPES
    if any(w in low for w in ("role", "opportunity", "project", "requirement")):
        return _DEMAND_TYPES + _CANDIDATE_TYPES
    return None  # let pgvector rank across everything


_PERSONA = {
    ROLE_PLANNER: (
        "You are advising a Workforce Planner. Focus on supply, availability, "
        "fit and which candidates to put forward."
    ),
    ROLE_DELIVERY: (
        "You are advising a Delivery Manager. Focus on technical fit, delivery "
        "risk, skill gaps and whether to approve the delivery fit."
    ),
    ROLE_CLIENT: (
        "You are advising a Client Manager (Sales / Client Partner). Focus on "
        "business fit, client suitability and approval of the engagement."
    ),
}

_NEXT_ACTIONS = {
    ROLE_PLANNER: "Next: open People Search or create a staffing proposal for the strongest matches.",
    ROLE_DELIVERY: "Next: review the technical fit in Recommendation Results and approve or request changes.",
    ROLE_CLIENT: "Next: confirm business fit in the EWA queue and approve or cancel with a comment.",
}


def _snippet(text: str, limit: int = 320) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"


def _deterministic_answer(question: str, role: str, docs: list[rag.RetrievedDoc]) -> str:
    if not docs:
        return (
            "I couldn't find matching evidence in the retrieval store for that. "
            "Try naming a skill, role, domain or location (e.g. \"React engineer in "
            "Banking\"), or use People Search for structured filters."
        )
    lines = [
        f"Based on the top {len(docs)} retrieved records (pgvector similarity), here's what the evidence shows:",
        "",
    ]
    for i, d in enumerate(docs[:4], 1):
        token = d.metadata.get("employee_token") or d.source_id or d.document_key
        lines.append(f"{i}. [{d.source_type}] {token} — {_snippet(d.content)}")
    lines.append("")
    lines.append(_NEXT_ACTIONS.get(role, ""))
    return "\n".join(p for p in lines if p is not None)


def _ai_answer(question: str, role: str, docs: list[rag.RetrievedDoc]) -> Optional[str]:
    facts = "\n".join(
        f"[{i}] ({d.source_type}, score={d.score:.2f}) {_snippet(d.content, 500)}"
        for i, d in enumerate(docs, 1)
    )
    system = (
        "You are TalentBridge, an AI workforce-planning assistant. "
        "Answer ONLY from the retrieved facts; if they are insufficient say what is "
        "missing. Never invent employees. Be concise. "
        + _PERSONA.get(role, "")
    )
    user = (
        f"Question: {question}\n\nRetrieved facts:\n{facts}\n\n"
        "Give: a direct answer, key evidence, risks/gaps, and a suggested next action."
    )
    return ai._chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}]
    )


def answer_question(question: str, role: str) -> ChatResponse:
    question = (question or "").strip()
    if not question:
        return ChatResponse(
            answer="Ask me about candidates, skills, roles, opportunities or approvals.",
            sources=[], retrieval="none", used_ai=False, role=role,
        )

    # RBAC: org-wide supply/bench analytics is Workforce-Planner-only.
    if _is_analytics(question) and not rbac.can_view_bench_analytics(role):
        return ChatResponse(
            answer=(
                "Bench and supply analytics are available to Workforce Planners. "
                "For your role, I can help with a specific opportunity or candidate — "
                "e.g. \"Is C0123 a good fit for a Java role in Banking?\""
            ),
            sources=[], retrieval="none", used_ai=False, role=role, restricted=True,
        )

    docs = rag.retrieve(question, top_k=6, source_types=_intent_source_types(question))
    retrieval = "pgvector" if rag.retrieval_enabled() else "fallback"
    if not docs:
        retrieval = "none" if retrieval == "fallback" else retrieval

    used_ai = False
    answer: Optional[str] = None
    if config.ai_enabled() and docs:
        answer = _ai_answer(question, role, docs)
        used_ai = answer is not None
    if not answer:
        answer = _deterministic_answer(question, role, docs)

    sources = [
        {
            "document_key": d.document_key,
            "source_type": d.source_type,
            "score": round(d.score, 4),
            "snippet": _snippet(d.content, 240),
        }
        for d in docs
    ]
    return ChatResponse(
        answer=answer, sources=sources, retrieval=retrieval, used_ai=used_ai, role=role,
    )
