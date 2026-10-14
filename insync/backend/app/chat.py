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

import logging
import re
from dataclasses import dataclass
from typing import Optional

from . import ai, config, rag
from .auth import ROLE_CLIENT, ROLE_DELIVERY, ROLE_PLANNER
from .data_layer import get_store
from .user_context import UserContext, build_context

logger = logging.getLogger(__name__)

# Roles allowed to draft a new opportunity from the chatbot (requirement §5).
_CREATE_ROLES = {ROLE_PLANNER, ROLE_CLIENT}

# --------------------------------------------------------------------------- #
# Exact response strings mandated by the spec (do not change the wording).      #
# --------------------------------------------------------------------------- #
INSUFFICIENT_EVIDENCE = "I couldn't find enough information to answer that question."
READ_ONLY_REFUSAL = (
    "I can explain the process and answer questions about the available workforce "
    "planning data, but I cannot perform business actions or modify records."
)
DELIVERY_SCOPE_DENIAL = (
    "You do not have permission to access information outside your assigned projects."
)
CLIENT_SCOPE_DENIAL = (
    "You do not have permission to access opportunities outside your assigned "
    "customer accounts."
)

# Action verbs that signal a write / business action. Matched on word boundaries
# so "approved"/"approval" (informational) do not trigger a false block.
_ACTION_VERBS = (
    "create", "update", "delete", "approve", "reject", "assign", "allocate",
    "submit", "modify", "book", "cancel", "remove", "deploy", "promote",
    "trigger", "edit", "insert", "drop", "grant", "revoke", "schedule",
)
_ACTION_PHRASES = (
    "submit to ewa", "generate proposal", "generate a proposal",
    "trigger workflow", "modify db", "modify the database", "add to ewa",
    "push to ewa", "set status", "mark as",
)
# When the prompt is clearly about the *process* we explain rather than refuse —
# but the refusal string itself offers to explain, so this is a soft allowance.
_PROCESS_HINTS = (
    "how do", "how to", "how does", "what happens", "what is the process",
    "explain the process", "steps to", "process for", "process of",
)

# Enterprise-wide / company-wide intent (out of scope for Delivery & Client).
_ENTERPRISE_TERMS = (
    "enterprise", "company-wide", "company wide", "organisation", "organization",
    "org-wide", "all projects", "every project", "all employees", "everyone",
    "whole bench", "entire bench", "all teams", "across the company",
    "other delivery", "other manager", "all accounts", "every account",
)
# Internal supply/bench terms a Client Partner may never see.
_INTERNAL_SUPPLY_TERMS = (
    "bench", "utilisation", "utilization", "internal staff", "headcount",
    "supply", "rolling off", "roll-off", "availability of employees",
)
_ACTION_VERB_RE = re.compile(
    r"\b(" + "|".join(_ACTION_VERBS) + r")\b", re.IGNORECASE
)

# Minimum retrieval similarity for a document to count as usable evidence.
# Below this, the question is treated as having insufficient evidence rather
# than answered from weakly-related records (prevents fabrication / drift).
_MIN_RELEVANCE_SCORE = 0.18

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
        locations = filters.get("locations") or []
        skills = filters.get("skills") or []
        if locations and skills:
            answer = (
                "Unfortunately, there aren't any available people for this location "
                f"({', '.join(locations)}) and this skill set ({', '.join(skills)})."
            )
        elif locations:
            answer = (
                "Unfortunately, there aren't any available people for this location "
                f"({', '.join(locations)})."
            )
        elif skills:
            answer = (
                "Unfortunately, there aren't any available people with this skill set "
                f"({', '.join(skills)})."
            )
        else:
            answer = f"I searched for {label}, but did not find any matching people."
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


# --------------------------------------------------------------------------- #
# Read-only enforcement                                                         #
# --------------------------------------------------------------------------- #
def is_action_request(question: str) -> bool:
    """True when the prompt asks the assistant to perform a business action.

    Action-intent prompts (create/update/delete/approve/reject/assign/allocate/
    submit to EWA/generate proposal/trigger workflow/modify DB) are blocked. A
    staffing *brief* ("Need 2 engineers …") is a query, not an action, and is
    not blocked here. Clear process/explanation questions are allowed through.
    """
    low = question.lower()
    if any(hint in low for hint in _PROCESS_HINTS):
        return False
    if any(phrase in low for phrase in _ACTION_PHRASES):
        return True
    return bool(_ACTION_VERB_RE.search(low))


# --------------------------------------------------------------------------- #
# RBAC scope enforcement (exact denial strings per role)                        #
# --------------------------------------------------------------------------- #
def _mentions_any(question: str, terms) -> bool:
    low = question.lower()
    return any(term in low for term in terms)


def _referenced_out_of_scope_accounts(question: str, ctx: UserContext) -> bool:
    """True when the prompt names a known account outside the caller's scope."""
    try:
        all_accounts = {
            o.get("client_name")
            for o in get_store().all_opportunities()
            if o.get("client_name")
        }
    except Exception:  # pragma: no cover - DB unavailable
        return False
    accessible = {a.lower() for a in ctx.accessible_accounts}
    qnorm = _norm(question)
    for account in all_accounts:
        if account and _contains_phrase(qnorm, account) and account.lower() not in accessible:
            return True
    return False


def rbac_scope_denial(question: str, ctx: UserContext) -> Optional[str]:
    """Return the exact denial string if the query is outside the caller's scope."""
    if ctx.user_role == ROLE_PLANNER:
        return None  # enterprise-wide visibility

    if ctx.user_role == ROLE_DELIVERY:
        if _mentions_any(question, _ENTERPRISE_TERMS):
            return DELIVERY_SCOPE_DENIAL
        if _mentions_any(question, ("bench", "supply", "utilisation", "utilization")):
            # Enterprise bench/supply analytics are not visible to Delivery.
            return DELIVERY_SCOPE_DENIAL
        if _referenced_out_of_scope_accounts(question, ctx):
            return DELIVERY_SCOPE_DENIAL
        return None

    if ctx.user_role == ROLE_CLIENT:
        if _mentions_any(question, _ENTERPRISE_TERMS):
            return CLIENT_SCOPE_DENIAL
        if _mentions_any(question, _INTERNAL_SUPPLY_TERMS):
            return CLIENT_SCOPE_DENIAL
        if _referenced_out_of_scope_accounts(question, ctx):
            return CLIENT_SCOPE_DENIAL
        return None

    return None


# --------------------------------------------------------------------------- #
# Security: mask confidential internal identifiers in human-facing text         #
# --------------------------------------------------------------------------- #
_UUID_RE = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)


def _mask_ids(text: str) -> str:
    """Redact UUID-style internal identifiers from a human-facing string."""
    return _UUID_RE.sub("[internal-id]", text or "")


# --------------------------------------------------------------------------- #
# 7-part response formatting                                                    #
# --------------------------------------------------------------------------- #
def format_sections(
    summary: str,
    key_findings: list[str],
    evidence: list[str],
    confidence: str,
    risks: list[str],
    next_actions: list[str],
    ewa: str,
) -> str:
    """Render the mandated 7-section structure (omitting empty list bullets)."""
    def block(title: str, body) -> list[str]:
        lines = [title]
        if isinstance(body, list):
            if body:
                lines.extend(f"- {b}" for b in body)
            else:
                lines.append("- None identified from the retrieved evidence.")
        else:
            lines.append(body)
        lines.append("")
        return lines

    out: list[str] = []
    out += block("Executive Summary", summary)
    out += block("Key Findings", key_findings)
    out += block("Supporting Evidence", evidence)
    out += block("Confidence Level", confidence)
    out += block("Risks / Constraints", risks)
    out += block("Recommended Next Actions", next_actions)
    out += block("EWA Considerations", ewa)
    return _mask_ids("\n".join(out).strip())


def _role_source_types(ctx: UserContext, question: str) -> Optional[list[str]]:
    """Role-specific retrieval source filtering."""
    if ctx.user_role == ROLE_PLANNER:
        return _intent_source_types(question)  # broad access
    if ctx.user_role == ROLE_DELIVERY:
        # Project-relevant sources only (no enterprise bench summaries).
        return _DEMAND_TYPES + _CANDIDATE_TYPES + _PROPOSAL_TYPES
    if ctx.user_role == ROLE_CLIENT:
        # Account / opportunity relevant only; never internal employee evidence.
        return _DEMAND_TYPES + _PROPOSAL_TYPES
    return _intent_source_types(question)


def _sectioned_from_docs(
    question: str, ctx: UserContext, docs: list[rag.RetrievedDoc]
) -> str:
    """Build a 7-section, evidence-only answer from retrieved documents."""
    ai_text = _ai_answer(question, ctx.user_role, docs) if config.ai_enabled() else None
    evidence = [
        f"[{d.source_type}] " + _snippet(
            _mask_ids(
                str(d.metadata.get("employee_token") or d.source_id or d.document_key)
                + ": " + d.content
            ),
            260,
        )
        for d in docs[:4]
    ]
    if ai_text:
        summary = _mask_ids(_snippet(ai_text, 600))
    else:
        summary = (
            f"Based on the top {len(docs)} retrieved record(s), here is what the "
            "available workforce-planning evidence indicates."
        )
    findings = [
        _mask_ids(_snippet(d.content, 160)) for d in docs[:3]
    ]
    avg = sum(d.score for d in docs) / len(docs)
    confidence = (
        f"{'High' if avg >= 0.6 else 'Medium' if avg >= 0.4 else 'Low'} — "
        f"grounded in {len(docs)} retrieved record(s) (avg similarity {avg:.2f})."
    )
    risks: list[str] = []
    if avg < 0.45:
        risks.append("Retrieved evidence is weakly related to the question.")
    next_actions = [_NEXT_ACTIONS.get(ctx.user_role, "Review the supporting evidence.")]
    ewa = (
        "This is a read-only summary; any EWA submission or approval must be done "
        "through the EWA workflow by an authorised user."
    )
    return format_sections(
        summary, findings, evidence, confidence, risks, next_actions, ewa
    )


def answer_question(
    question: str,
    role: Optional[str] = None,
    context: Optional[UserContext] = None,
) -> ChatResponse:
    """Answer a chat question under read-only + RBAC + evidence-only constraints.

    Order of checks (spec §4.2): empty query -> read-only action block -> RBAC
    scope block -> role-specific retrieval filtering -> retrieval -> evidence-only
    answer -> insufficient-evidence fallback.
    """
    ctx = context
    role = (ctx.user_role if ctx else role) or ""
    question = (question or "").strip()

    # 1. Empty query.
    if not question:
        return ChatResponse(
            answer="Ask me about candidates, skills, roles, opportunities or approvals.",
            sources=[], retrieval="none", used_ai=False, role=role,
        )

    # 2. Read-only action block.
    if is_action_request(question):
        logger.info("chat read-only block: role=%s", role)
        return ChatResponse(
            answer=READ_ONLY_REFUSAL,
            sources=[], retrieval="none", used_ai=False, role=role, restricted=True,
        )

    # 3. RBAC scope block (exact per-role denial strings).
    if ctx is not None:
        denial = rbac_scope_denial(question, ctx)
        if denial:
            logger.info("chat RBAC denial: role=%s reason=out-of-scope", role)
            return ChatResponse(
                answer=denial,
                sources=[], retrieval="none", used_ai=False, role=role,
                restricted=True,
            )

    # Opportunity-drafting intent: a natural-language staffing brief (query only,
    # never writes). Planners and Client Managers may draft one from the chatbot.
    if _is_opportunity_brief(question) and role in _CREATE_ROLES:
        store = get_store()
        parsed = ai.parse_requirement(question, store.snapshot_date)
        return ChatResponse(
            answer=_opportunity_answer(parsed, role),
            sources=[], retrieval="none", used_ai=config.ai_enabled(), role=role,
            intent="create_opportunity", opportunity=parsed,
        )

    # Deterministic candidate lookup (Planner / Delivery only — Client Partners
    # never see internal staff). Explicit locations are hard filters.
    if role in (ROLE_PLANNER, ROLE_DELIVERY):
        candidate_answer = _candidate_lookup_answer(question, role)
        if candidate_answer:
            answer, sources = candidate_answer
            return ChatResponse(
                answer=_mask_ids(answer),
                sources=sources,
                retrieval=rag.active_backend() if rag.retrieval_enabled() else "fallback",
                used_ai=False,
                role=role,
            )

    # 4-5. Role-specific source filtering + retrieval execution.
    source_types = _role_source_types(ctx, question) if ctx else _intent_source_types(question)
    docs = rag.retrieve(question, top_k=6, source_types=source_types)
    backend = rag.active_backend()

    # Evidence-only guard: drop weakly-related matches so off-topic questions
    # fall through to the insufficient-evidence response instead of fabricating.
    if ctx is not None:
        docs = [d for d in docs if d.score >= _MIN_RELEVANCE_SCORE]

    # 7. Insufficient-evidence fallback (exact string).
    if not docs:
        return ChatResponse(
            answer=INSUFFICIENT_EVIDENCE,
            sources=[], retrieval="none", used_ai=False, role=role,
        )

    # 6. Evidence-only answer in the mandated 7-section format.
    if ctx is not None:
        answer = _sectioned_from_docs(question, ctx, docs)
        used_ai = config.ai_enabled()
    else:
        used_ai = False
        answer = None
        if config.ai_enabled():
            answer = _ai_answer(question, role, docs)
            used_ai = answer is not None
        if not answer:
            answer = _deterministic_answer(question, role, docs)
        answer = _mask_ids(answer)

    sources = [
        {
            "document_key": _mask_ids(str(d.document_key)),
            "source_type": d.source_type,
            "score": round(d.score, 4),
            "snippet": _mask_ids(_snippet(d.content, 240)),
        }
        for d in docs
    ]
    return ChatResponse(
        answer=answer, sources=sources, retrieval=backend, used_ai=used_ai, role=role,
    )


def answer_for_user(question: str, user) -> ChatResponse:
    """Convenience entrypoint: build the user context, then answer."""
    ctx = build_context(user)
    return answer_question(question, context=ctx)
