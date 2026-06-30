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
from .data_layer import get_store

# Roles allowed to draft a new opportunity from the chatbot (requirement §5).
_CREATE_ROLES = {ROLE_PLANNER, ROLE_CLIENT}

# Verbs/keywords that signal the user is describing a NEW opportunity to staff.
_BRIEF_TERMS = (
    "need", "looking for", "require", "want", "staff", "build a team",
    "set up a team", "resource", "create an opportunity", "new opportunity",
)
_ROLE_WORDS = (
    "developer", "engineer", "qa", "tester", "pm", "project manager", "analyst",
    "architect", "designer", "lead", "consultant", "scientist", "devops",
)

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
    intent: str = "qa"  # "qa" | "create_opportunity"
    opportunity: Optional[dict] = None  # parsed structured brief, when applicable


def _is_analytics(question: str) -> bool:
    low = question.lower()
    return any(term in low for term in _ANALYTICS_TERMS)


def _is_opportunity_brief(question: str) -> bool:
    """Heuristic: a staffing brief mentions an intent verb + a role/headcount."""
    low = question.lower()
    has_intent = any(term in low for term in _BRIEF_TERMS)
    has_role = any(word in low for word in _ROLE_WORDS)
    has_count = bool(re.search(r"\b\d+\s*[a-z]", low))
    return has_intent and (has_role or has_count)


def _opportunity_answer(parsed: dict, role: str) -> str:
    roles = parsed.get("roles", [])
    lines = [
        "I turned your brief into a structured opportunity:",
        "",
        f"• Summary: {parsed.get('summary', '—')}",
    ]
    if parsed.get("domain"):
        lines.append(f"• Domain: {parsed['domain']}")
    if parsed.get("location"):
        lines.append(f"• Location: {parsed['location']}")
    lines.append(
        f"• Start: in ~{parsed.get('start_window_days', '?')} days "
        f"({parsed.get('start_date', '—')}) · {parsed.get('required_fte', '?')} FTE total"
    )
    lines.append("• Roles:")
    for r in roles:
        skills = ", ".join(r.get("required_skills", [])[:4]) or "—"
        lines.append(
            f"   – {r.get('count', 1)}× {r.get('role_name', 'Role')} "
            f"(skills: {skills})"
        )
    lines.append("")
    lines.append(
        'Open "Create Opportunity" and click "Generate staffing options" to '
        "score candidates against this brief."
    )
    return "\n".join(lines)


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


def _norm(value: object) -> str:
    """Normalize text for deterministic, punctuation-tolerant matching."""
    return re.sub(r"[^a-z0-9+#.]+", " ", str(value or "").lower()).strip()


def _contains_phrase(text_norm: str, phrase: str) -> bool:
    phrase_norm = _norm(phrase)
    return bool(phrase_norm and f" {phrase_norm} " in f" {text_norm} ")


def _loose_match(target: str, value: str) -> bool:
    target_norm = _norm(target)
    value_norm = _norm(value)
    return bool(
        target_norm
        and value_norm
        and (target_norm in value_norm or value_norm in target_norm)
    )


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        key = _norm(value)
        if key and key not in seen:
            seen.add(key)
            out.append(value)
    return out


def _detect_vocab(question: str, vocab: set[str]) -> list[str]:
    qnorm = _norm(question)
    matches = [
        value
        for value in sorted(vocab, key=lambda v: len(_norm(v)), reverse=True)
        if _contains_phrase(qnorm, value)
    ]
    return _dedupe(matches)


def _candidate_vocab(employees: list[dict]) -> tuple[set[str], set[str], set[str]]:
    store = get_store()
    skills = set(store.skill_vocabulary())
    domains = set(ai.DOMAINS)
    locations = set(ai.LOCATIONS)
    for emp in employees:
        for field in ("city", "country", "region"):
            if emp.get(field):
                locations.add(str(emp[field]))
        for field in ("primary_domain", "secondary_domain"):
            if emp.get(field):
                domains.add(str(emp[field]))
        for skill in emp.get("skills", []):
            if skill.get("name"):
                skills.add(str(skill["name"]))
        for hist in emp.get("project_history", []):
            if hist.get("domain"):
                domains.add(str(hist["domain"]))
    return skills, domains, locations


def _availability_filter(question: str) -> Optional[set[str]]:
    qnorm = _norm(question)
    if _contains_phrase(qnorm, "current bench") or _contains_phrase(qnorm, "bench"):
        return {"Current Bench"}
    if _contains_phrase(qnorm, "partial capacity"):
        return {"Partial Capacity"}
    if any(_contains_phrase(qnorm, term) for term in ("available", "availability", "free")):
        return {"Current Bench", "Partial Capacity", "Rolling Off 0-30"}
    if _contains_phrase(qnorm, "rolling off"):
        return {"Rolling Off 0-30", "Rolling Off 31-60", "Rolling Off 61-90"}
    return None


def _role_filter(question: str) -> list[str]:
    qnorm = _norm(question)
    roles: list[str] = []
    if any(_contains_phrase(qnorm, term) for term in ("engineer", "engineers", "developer", "developers")):
        roles.extend(["engineer", "engineering", "developer"])
    if any(_contains_phrase(qnorm, term) for term in ("qa", "tester", "testers", "testing")):
        roles.extend(["qa", "test", "quality"])
    if any(_contains_phrase(qnorm, term) for term in ("pm", "project manager", "project managers")):
        roles.extend(["project manager", "project management", "pm"])
    return _dedupe(roles)


def _candidate_filters(question: str, employees: list[dict]) -> Optional[dict]:
    skills_vocab, domains_vocab, locations_vocab = _candidate_vocab(employees)
    filters = {
        "skills": _detect_vocab(question, skills_vocab),
        "domains": _detect_vocab(question, domains_vocab),
        "locations": _detect_vocab(question, locations_vocab),
        "roles": _role_filter(question),
        "availability": _availability_filter(question),
    }
    qnorm = _norm(question)
    looks_like_lookup = any(
        _contains_phrase(qnorm, term)
        for term in (
            "find",
            "show",
            "who",
            "which",
            "people",
            "person",
            "candidate",
            "candidates",
            "employee",
            "employees",
            "skill",
            "experience",
        )
    )
    has_filter = any(
        filters[key] for key in ("skills", "domains", "locations", "roles", "availability")
    )
    if looks_like_lookup and has_filter:
        return filters

    # Also support terse prompts like "React Banking Pune".
    filter_groups = sum(1 for key in ("skills", "domains", "locations", "roles") if filters[key])
    return filters if filter_groups >= 2 else None


def _skill_hits(emp: dict, requested: list[str]) -> list[str]:
    if not requested:
        return []
    owned = [s.get("name") for s in emp.get("skills", []) if s.get("name")]
    return [
        skill
        for skill in requested
        if any(_loose_match(skill, owned_skill) for owned_skill in owned)
    ]


def _location_hit(emp: dict, requested: list[str]) -> Optional[str]:
    """Strict location match: city first, then country, then region.

    A concrete city request (e.g. Pune) must match the candidate's own
    city/country/region — candidates based elsewhere are excluded entirely,
    regardless of how strong their other signals are.
    """
    for location in requested:
        if _loose_match(location, emp.get("city") or ""):
            return f"Based in {emp.get('city')}"
        if _loose_match(location, emp.get("country") or ""):
            return f"Based in {emp.get('country')}"
        if _loose_match(location, emp.get("region") or ""):
            return f"In region {emp.get('region')}"
    return None


def _domain_hit(emp: dict, requested: list[str]) -> Optional[str]:
    for domain in requested:
        if _loose_match(domain, emp.get("primary_domain") or ""):
            return f"Primary domain {emp.get('primary_domain')}"
        if _loose_match(domain, emp.get("secondary_domain") or ""):
            return f"Secondary domain {emp.get('secondary_domain')}"
        for hist in emp.get("project_history", []):
            if _loose_match(domain, hist.get("domain") or ""):
                project = hist.get("project_name") or "a past project"
                return f"Delivered {project} in {hist.get('domain')}"
    return None


def _role_hit(emp: dict, requested: list[str]) -> Optional[str]:
    if not requested:
        return None
    fields = [
        emp.get("role_archetype") or "",
        emp.get("discipline") or "",
        emp.get("current_role") or "",
    ]
    for role in requested:
        for value in fields:
            if _loose_match(role, value):
                return f"Role {value}"
    return None


def _candidate_match(emp: dict, filters: dict) -> Optional[dict]:
    groups = 0
    hits = 0
    evidence: list[str] = []

    requested_skills = filters["skills"]
    skill_hits = _skill_hits(emp, requested_skills)
    if requested_skills:
        groups += 1
        if len(skill_hits) == len(requested_skills):
            hits += 1
            evidence.append("Skills: " + ", ".join(skill_hits))
        else:
            return None

    requested_locations = filters["locations"]
    location_hit = _location_hit(emp, requested_locations)
    if requested_locations:
        groups += 1
        # Hard location filter: no match -> candidate is excluded outright.
        if location_hit:
            hits += 1
            evidence.append(location_hit)
        else:
            return None

    requested_domains = filters["domains"]
    domain_hit = _domain_hit(emp, requested_domains)
    if requested_domains:
        groups += 1
        if domain_hit:
            hits += 1
            evidence.append(domain_hit)
        else:
            return None

    requested_roles = filters["roles"]
    role_hit = _role_hit(emp, requested_roles)
    if requested_roles:
        groups += 1
        if role_hit:
            hits += 1
            evidence.append(role_hit)
        else:
            return None

    availability = filters["availability"]
    if availability:
        groups += 1
        category = emp.get("availability_category")
        if category in availability:
            hits += 1
            evidence.append(f"Availability {category}")
        else:
            return None

    if groups == 0 or hits == 0:
        return None

    availability_order = {
        "Current Bench": 0,
        "Partial Capacity": 1,
        "Rolling Off 0-30": 2,
        "Rolling Off 31-60": 3,
        "Rolling Off 61-90": 4,
        "Allocated >90": 5,
        "Booked": 6,
    }
    return {
        "employee": emp,
        "evidence": evidence,
        "score": hits / groups,
        "exact": hits == groups,
        "availability_rank": availability_order.get(emp.get("availability_category"), 9),
    }


def _filters_label(filters: dict) -> str:
    bits = []
    if filters["locations"]:
        bits.append("location " + ", ".join(filters["locations"]))
    if filters["skills"]:
        bits.append("skill " + ", ".join(filters["skills"]))
    if filters["domains"]:
        bits.append("domain experience " + ", ".join(filters["domains"]))
    if filters["roles"]:
        bits.append("role " + ", ".join(filters["roles"]))
    if filters["availability"]:
        bits.append("availability " + ", ".join(sorted(filters["availability"])))
    return "; ".join(bits)


def _candidate_line(match: dict, index: int) -> str:
    emp = match["employee"]
    place = ", ".join(v for v in (emp.get("city"), emp.get("country")) if v)
    availability = emp.get("availability_category") or "availability unknown"
    fte = emp.get("available_fte_current")
    fte_text = f", {fte} FTE free" if fte is not None else ""
    evidence = "; ".join(match["evidence"]) or "Matched profile"
    return (
        f"{index}. {emp.get('name')} ({emp.get('employee_id')}) - "
        f"{emp.get('role_archetype') or emp.get('discipline')}, {place}. "
        f"{availability}{fte_text}. Evidence: {evidence}."
    )


def _candidate_source(match: dict) -> dict:
    emp = match["employee"]
    snippet = (
        f"{emp.get('name')} ({emp.get('employee_id')}), "
        f"{emp.get('role_archetype') or emp.get('discipline')}, "
        f"{emp.get('city')}, {emp.get('country')}. "
        f"{emp.get('availability_category')} with {emp.get('available_fte_current')} FTE free. "
        f"{'; '.join(match['evidence'])}"
    )
    return {
        "document_key": emp.get("employee_id"),
        "source_type": "candidate",
        "score": round(float(match["score"]), 4),
        "snippet": _snippet(snippet, 240),
    }


def _candidate_lookup_answer(question: str, role: str) -> Optional[tuple[str, list[dict]]]:
    store = get_store()
    employees = store.all_employees()
    filters = _candidate_filters(question, employees)
    if not filters:
        return None

    matches = [
        match
        for emp in employees
        if (match := _candidate_match(emp, filters)) is not None
    ]
    matches.sort(
        key=lambda m: (
            not m["exact"],
            -m["score"],
            m["availability_rank"],
            m["employee"].get("name") or "",
        )
    )

    exact = [m for m in matches if m["exact"]]
    selected = (exact or matches)[:6]
    label = _filters_label(filters)
    if not selected:
        answer = (
            f"I searched for {label}, but did not find any matching people. "
            "Try relaxing one filter or use People Search to browse the full pool."
        )
        return answer, []

    if exact:
        lines = [f"Found {len(exact)} people matching {label}:", ""]
    else:
        lines = [
            f"I did not find an exact match for {label}. Closest partial matches:",
            "",
        ]
    for i, match in enumerate(selected, 1):
        lines.append(_candidate_line(match, i))
    lines.append("")
    lines.append(_NEXT_ACTIONS.get(role, ""))
    return "\n".join(line for line in lines if line is not None), [
        _candidate_source(match) for match in selected
    ]


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

    # Opportunity-creation intent: a natural-language staffing brief. Planners
    # and Client Managers can draft one straight from the chatbot (requirement §5).
    if _is_opportunity_brief(question) and role in _CREATE_ROLES:
        store = get_store()
        parsed = ai.parse_requirement(question, store.snapshot_date)
        return ChatResponse(
            answer=_opportunity_answer(parsed, role),
            sources=[], retrieval="none", used_ai=config.ai_enabled(), role=role,
            intent="create_opportunity", opportunity=parsed,
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

    # Deterministic candidate lookup. Explicit locations are hard filters here:
    # a "Pune" question only returns Pune-based people, never Mumbai/Perth/etc.
    candidate_answer = _candidate_lookup_answer(question, role)
    if candidate_answer:
        answer, sources = candidate_answer
        return ChatResponse(
            answer=answer,
            sources=sources,
            retrieval="fallback",
            used_ai=False,
            role=role,
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
