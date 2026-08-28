"""AI layer for InSync.

AI is used for exactly three things (per the brief):
    1. Parsing a natural-language opportunity into structured role demand.
    2. Explaining *why* the engine recommended a candidate / option.
    3. Highlighting risks, gaps and next actions in prose.

AI never selects candidates - the deterministic scoring engine does that first.

If no API key is configured the module transparently falls back to a
deterministic *mock* parser and explainer, so the app is always functional.
"""
from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Optional

from . import config

# --------------------------------------------------------------------------
# Domain / location / role vocabularies (used by the mock parser and to seed
# the real-AI prompt). Derived from the dataset's taxonomies.
# --------------------------------------------------------------------------
DOMAINS = [
    "Banking", "Payments", "Healthcare", "Retail", "Insurance",
    "Telecommunications", "Energy", "Public Sector", "Financial Services",
    "Internal Platforms", "Media", "Travel", "Education", "Logistics",
    "Legacy Platforms", "Data & AI",
]

LOCATIONS = [
    "Australia", "India", "Vietnam", "Malaysia", "Singapore", "UAE",
    "Saudi Arabia", "Egypt", "Jordan", "APAC", "MENA",
    "Sydney", "Melbourne", "Brisbane", "Perth", "Canberra", "Pune",
    "Bengaluru", "Hyderabad", "Chennai", "Kuala Lumpur", "Ho Chi Minh City",
    "Hanoi", "Dubai",
]

GRADES = [
    "Associate Consultant", "Consultant", "Senior Consultant",
    "Lead Consultant", "Manager", "Senior Manager", "Principal Consultant",
]

# Role keyword -> canonical role name + default required/desired skills.
ROLE_LIBRARY: dict[str, dict] = {
    "java": {
        "role_name": "Backend Engineer",
        "required_skills": ["Java", "REST API Design", "Microservices"],
        "desired_skills": ["Spring Boot", "AWS"],
    },
    "backend": {
        "role_name": "Backend Engineer",
        "required_skills": ["Java", "REST API Design", "Microservices"],
        "desired_skills": ["Spring Boot", "AWS"],
    },
    ".net": {
        "role_name": "Backend Engineer",
        "required_skills": [".NET", "REST API Design"],
        "desired_skills": ["Azure", "Microservices"],
    },
    "frontend": {
        "role_name": "Frontend Engineer",
        "required_skills": ["React", "TypeScript", "API Integration"],
        "desired_skills": ["Node.js", "Accessibility"],
    },
    "react": {
        "role_name": "Frontend Engineer",
        "required_skills": ["React", "TypeScript", "API Integration"],
        "desired_skills": ["Node.js"],
    },
    "full stack": {
        "role_name": "Full Stack Engineer",
        "required_skills": ["React", "Node.js", "REST API Design"],
        "desired_skills": ["TypeScript", "AWS"],
    },
    "qa": {
        "role_name": "QA Engineer",
        "required_skills": ["Test Automation", "API Testing"],
        "desired_skills": ["Test Data Management"],
    },
    "test": {
        "role_name": "Test Automation Engineer",
        "required_skills": ["Test Automation", "API Testing"],
        "desired_skills": ["Performance Testing"],
    },
    "pm": {
        "role_name": "Project Manager",
        "required_skills": ["Agile Delivery", "Stakeholder Management"],
        "desired_skills": ["Risk Management"],
    },
    "project manager": {
        "role_name": "Project Manager",
        "required_skills": ["Agile Delivery", "Stakeholder Management"],
        "desired_skills": ["Risk Management"],
    },
    "delivery manager": {
        "role_name": "Delivery Manager",
        "required_skills": ["Agile Delivery", "Risk Management"],
        "desired_skills": ["Stakeholder Management", "Governance"],
    },
    "scrum master": {
        "role_name": "Scrum Master",
        "required_skills": ["Agile Delivery"],
        "desired_skills": ["Stakeholder Management"],
    },
    "business analyst": {
        "role_name": "Business Analyst",
        "required_skills": ["Requirements Analysis", "Process Mapping"],
        "desired_skills": ["User Stories", "Domain Modelling"],
    },
    "ba": {
        "role_name": "Business Analyst",
        "required_skills": ["Requirements Analysis", "Process Mapping"],
        "desired_skills": ["User Stories"],
    },
    "data engineer": {
        "role_name": "Data Engineer",
        "required_skills": ["Data Engineering", "SQL", "Python"],
        "desired_skills": ["Azure Data Factory", "Snowflake"],
    },
    "data scientist": {
        "role_name": "Data Scientist",
        "required_skills": ["Python", "SQL"],
        "desired_skills": ["RAG", "Evals"],
    },
    "ai engineer": {
        "role_name": "AI Engineer",
        "required_skills": ["LLM Integration", "Agentic Workflows", "OpenAI API"],
        "desired_skills": ["RAG", "Evals"],
    },
    "ml engineer": {
        "role_name": "ML Engineer",
        "required_skills": ["Python", "RAG"],
        "desired_skills": ["OpenAI API", "Evals"],
    },
    "data architect": {
        "role_name": "Data Architect",
        "required_skills": ["Data Architecture", "Cloud Architecture"],
        "desired_skills": ["Azure", "Security Architecture"],
    },
    "solution architect": {
        "role_name": "Solution Architect",
        "required_skills": ["Solution Architecture", "Cloud Architecture"],
        "desired_skills": ["Event-Driven Architecture"],
    },
    "cloud engineer": {
        "role_name": "Cloud Engineer",
        "required_skills": ["AWS", "Kubernetes", "CI/CD"],
        "desired_skills": ["Azure"],
    },
    "devops": {
        "role_name": "DevOps Engineer",
        "required_skills": ["CI/CD", "Kubernetes"],
        "desired_skills": ["AWS", "Azure"],
    },
    "security": {
        "role_name": "Security Engineer",
        "required_skills": ["Security Architecture"],
        "desired_skills": ["Identity & Access"],
    },
    "ux": {
        "role_name": "UX Designer",
        "required_skills": ["UX Research", "Journey Mapping", "Figma"],
        "desired_skills": ["Usability Testing", "Prototyping"],
    },
    "ui": {
        "role_name": "UI Designer",
        "required_skills": ["Figma", "Design Systems"],
        "desired_skills": ["Accessibility"],
    },
    "product designer": {
        "role_name": "Product Designer",
        "required_skills": ["Product Design", "Figma", "Prototyping"],
        "desired_skills": ["Design Systems", "Accessibility"],
    },
    "product manager": {
        "role_name": "Product Manager",
        "required_skills": ["Product Strategy"],
        "desired_skills": ["Stakeholder Management"],
    },
    "integration engineer": {
        "role_name": "Integration Engineer",
        "required_skills": ["API Integration", "Event-Driven Architecture"],
        "desired_skills": ["REST API Design"],
    },
    "mobile": {
        "role_name": "Mobile Engineer",
        "required_skills": ["Mobile Engineering"],
        "desired_skills": ["React"],
    },
    "developer": {  # generic fallback when only "developer"/"engineer" seen
        "role_name": "Software Engineer",
        "required_skills": ["REST API Design"],
        "desired_skills": ["CI/CD"],
    },
    "engineer": {
        "role_name": "Software Engineer",
        "required_skills": ["REST API Design"],
        "desired_skills": ["CI/CD"],
    },
}

_NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}


# --------------------------------------------------------------------------
# Mock (deterministic) natural-language parser
# --------------------------------------------------------------------------
def _detect(text: str, vocab: list[str]) -> Optional[str]:
    low = text.lower()
    # Longest match first so "Saudi Arabia" wins over "Arabia" etc.
    for item in sorted(vocab, key=len, reverse=True):
        if re.search(r"\b" + re.escape(item.lower()) + r"\b", low):
            return item
    return None


def _detect_grade(text: str) -> Optional[str]:
    low = text.lower()
    grade = _detect(text, GRADES)
    if grade:
        return grade
    if "principal" in low:
        return "Principal Consultant"
    if "lead" in low:
        return "Lead Consultant"
    if re.search(r"\bsenior\b", low):
        return "Senior Consultant"
    if re.search(r"\bjunior\b|\bassociate\b", low):
        return "Associate Consultant"
    if "manager" in low:
        return "Manager"
    return None


def _word_tokens(s: str) -> list[str]:
    """Split a string into alphanumeric runs, breaking at letter/digit
    boundaries (so "30days" -> ["30", "days"]).

    Hand-rolled instead of a regex so there is no catastrophic-backtracking
    surface when parsing arbitrary free-text input.
    """
    tokens: list[str] = []
    cur = ""
    cur_is_digit: bool | None = None
    for ch in s:
        if ch.isalnum():
            is_digit = ch.isdigit()
            if cur and is_digit != cur_is_digit:
                tokens.append(cur)
                cur = ""
            cur += ch
            cur_is_digit = is_digit
        elif cur:
            tokens.append(cur)
            cur = ""
            cur_is_digit = None
    if cur:
        tokens.append(cur)
    return tokens


def _count_in_prefix(prefix: str) -> int:
    """Return the head-count that directly qualifies a role keyword.

    A number (digits or a number-word) only counts when it is connected to the
    keyword by word / space / slash characters; a comma or other punctuation
    breaks the association. Implemented without a regex to avoid backtracking.
    """
    i = len(prefix) - 1
    while i >= 0 and (prefix[i].isalnum() or prefix[i] in " /_"):
        i -= 1
    for tok in _word_tokens(prefix[i + 1:]):
        if tok.isdigit():
            return int(tok)
        if tok in _NUMBER_WORDS:
            return _NUMBER_WORDS[tok]
    return 1


def _detect_start_window(text: str) -> int:
    low = text.lower()
    if "immediate" in low or "asap" in low or "now" in low or "right away" in low:
        return 0
    unit_days = {
        "day": 1, "days": 1,
        "week": 7, "weeks": 7,
        "month": 30, "months": 30,
    }
    tokens = _word_tokens(low)
    for idx, tok in enumerate(tokens):
        if tok.isdigit():
            for nxt in tokens[idx + 1: idx + 3]:
                if nxt in unit_days:
                    return int(tok) * unit_days[nxt]
    if "next month" in low:
        return 30
    if "next quarter" in low:
        return 90
    return 30  # sensible default start window


# Generic role words that should defer to a more specific role keyword nearby
# (e.g. "Java developer" -> Backend Engineer, not a generic Software Engineer).
_GENERIC_ROLE_KEYWORDS = {"developer", "engineer"}


def _parse_roles(text: str) -> list[dict]:
    """Extract (count, role) pairs from free text using the role library."""
    low = text.lower()
    roles: list[dict] = []
    used_spans: list[tuple[int, int]] = []

    # First pass: collect every specific (non-generic) keyword span so generic
    # words can be suppressed when they merely qualify a specific role.
    specific_spans: list[tuple[int, int]] = []
    for keyword in ROLE_LIBRARY:
        if keyword in _GENERIC_ROLE_KEYWORDS:
            continue
        specific_spans.extend(m.span() for m in re.finditer(r"\b" + re.escape(keyword) + r"\b", low))

    # Sort keys by length so multi-word keys ("project manager") match first.
    for keyword in sorted(ROLE_LIBRARY.keys(), key=len, reverse=True):
        for m in re.finditer(r"\b" + re.escape(keyword) + r"\b", low):
            span = m.span()
            # Skip if this span overlaps an already-claimed role keyword.
            if any(span[0] < e and s < span[1] for s, e in used_spans):
                continue
            # Suppress generic role words when a specific role sits next to them.
            if keyword in _GENERIC_ROLE_KEYWORDS and any(
                abs(span[0] - s) <= 25 for s, e in specific_spans
            ):
                continue
            # Look back up to ~20 chars for a count ("2 java", "two QA").
            prefix = low[max(0, span[0] - 20): span[0]]
            count = _count_in_prefix(prefix)
            lib = ROLE_LIBRARY[keyword]
            roles.append(
                {
                    "keyword": keyword,
                    "role_name": lib["role_name"],
                    "count": count,
                    "required_skills": list(lib["required_skills"]),
                    "desired_skills": list(lib["desired_skills"]),
                }
            )
            used_spans.append(span)

    # Merge duplicate role_names (e.g. "engineer" + "java" both -> Backend).
    merged: dict[str, dict] = {}
    for r in roles:
        key = r["role_name"]
        if key in merged:
            merged[key]["count"] = max(merged[key]["count"], r["count"])
            for s in r["required_skills"]:
                if s not in merged[key]["required_skills"]:
                    merged[key]["required_skills"].append(s)
        else:
            merged[key] = r
    return list(merged.values())


def mock_parse(text: str, snapshot: date) -> dict:
    """Deterministic fallback parser producing the structured requirement."""
    domain = _detect(text, DOMAINS)
    location = _detect(text, LOCATIONS)
    grade = _detect_grade(text)
    start_window = _detect_start_window(text)
    start_date = snapshot + timedelta(days=start_window)

    parsed_roles = _parse_roles(text)
    if not parsed_roles:
        parsed_roles = [
            {
                "role_name": "Software Engineer",
                "count": 1,
                "required_skills": ["REST API Design"],
                "desired_skills": ["CI/CD"],
            }
        ]

    roles = []
    for r in parsed_roles:
        roles.append(
            {
                "role_name": r["role_name"],
                "count": r["count"],
                "required_skills": r["required_skills"],
                "desired_skills": r["desired_skills"],
                "domain": domain,
                "location_preference": location,
                "grade_preference": grade,
                "fte_required": 1.0,
                "start_window_days": start_window,
                "start_date": start_date.isoformat(),
            }
        )

    total_fte = sum(r["count"] * r["fte_required"] for r in roles)
    return {
        "summary": _build_summary(roles, domain, location, start_window),
        "domain": domain,
        "location": location,
        "grade_preference": grade,
        "start_window_days": start_window,
        "start_date": start_date.isoformat(),
        "required_fte": round(total_fte, 1),
        "roles": roles,
        "parser": "mock",
    }


def _build_summary(roles, domain, location, start_window) -> str:
    parts = [f"{r['count']}x {r['role_name']}" for r in roles]
    s = "Requirement: " + ", ".join(parts)
    if domain:
        s += f" for a {domain} engagement"
    if location:
        s += f" in {location}"
    s += f", starting in ~{start_window} days."
    return s


# --------------------------------------------------------------------------
# Real AI parser (OpenAI / Azure OpenAI), used only when configured.
# --------------------------------------------------------------------------
_PARSE_SYSTEM = (
    "You are a workforce planning parser. Convert the manager's natural-language "
    "staffing request into STRICT JSON. Do not invent employees. "
    "Schema: {\"domain\": str|null, \"location\": str|null, "
    "\"grade_preference\": str|null, \"start_window_days\": int, "
    "\"roles\": [{\"role_name\": str, \"count\": int, "
    "\"required_skills\": [str], \"desired_skills\": [str], \"fte_required\": number}]}. "
    f"Valid domains: {', '.join(DOMAINS)}. Valid locations: {', '.join(LOCATIONS)}. "
    f"Valid grades: {', '.join(GRADES)}. Return ONLY JSON."
)


def _chat(messages: list[dict], temperature: float = 0.2) -> Optional[str]:
    """Delegate to the provider-independent LLM service; None on any failure.

    The active provider is selected purely by ``LLM_PROVIDER`` and the service
    degrades safely to deterministic mode when the provider is unavailable.
    """
    from . import llm

    return llm.get_service().chat(messages, temperature)


def _safe_json(raw: str) -> Optional[dict]:
    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        return json.loads(match.group(0)) if match else None
    except (json.JSONDecodeError, AttributeError):
        return None


def parse_requirement(text: str, snapshot: date) -> dict:
    """Parse NL -> structured requirement, using real AI if configured."""
    if config.ai_enabled():
        raw = _chat(
            [
                {"role": "system", "content": _PARSE_SYSTEM},
                {"role": "user", "content": text},
            ]
        )
        data = _safe_json(raw) if raw else None
        if data and data.get("roles"):
            return _normalise_ai_parse(data, snapshot, text)
    # Fallback: deterministic mock parser.
    return mock_parse(text, snapshot)


def _normalise_ai_parse(data: dict, snapshot: date, text: str) -> dict:
    start_window = int(data.get("start_window_days") or _detect_start_window(text))
    start_date = snapshot + timedelta(days=start_window)
    roles = []
    for r in data.get("roles", []):
        roles.append(
            {
                "role_name": r.get("role_name") or "Software Engineer",
                "count": int(r.get("count") or 1),
                "required_skills": r.get("required_skills") or [],
                "desired_skills": r.get("desired_skills") or [],
                "domain": data.get("domain"),
                "location_preference": data.get("location"),
                "grade_preference": data.get("grade_preference"),
                "fte_required": float(r.get("fte_required") or 1.0),
                "start_window_days": start_window,
                "start_date": start_date.isoformat(),
            }
        )
    total_fte = sum(r["count"] * r["fte_required"] for r in roles)
    return {
        "summary": _build_summary(roles, data.get("domain"), data.get("location"), start_window),
        "domain": data.get("domain"),
        "location": data.get("location"),
        "grade_preference": data.get("grade_preference"),
        "start_window_days": start_window,
        "start_date": start_date.isoformat(),
        "required_fte": round(total_fte, 1),
        "roles": roles,
        "parser": "ai",
    }


# --------------------------------------------------------------------------
# Explanations (why this candidate / option)
# --------------------------------------------------------------------------
def explain_candidate(candidate: dict, role_name: str) -> str:
    """Generate a recommendation rationale for a single candidate."""
    if config.ai_enabled():
        text = _ai_explain_candidate(candidate, role_name)
        if text:
            return text
    return mock_explain_candidate(candidate, role_name)


def mock_explain_candidate(c: dict, role_name: str) -> str:
    skill = c["skill_detail"]
    avail = c["availability_detail"]
    matched = ", ".join(skill["matched_required"]) or "no required skills"
    bits = [
        f"{c['name']} ({c['grade']}, {c['country']}) scores {c['overall_score']}/100 "
        f"for {role_name}."
    ]
    bits.append(
        f"Skills: matched {len(skill['matched_required'])}/{skill['required_total']} "
        f"required ({matched})."
    )
    if skill["missing_required"]:
        bits.append("Gap: " + ", ".join(skill["missing_required"]) + ".")
    bits.append(c["domain_detail"]["evidence"])
    if avail["covers_start"]:
        bits.append(
            f"Available {avail['available_fte_at_start']} FTE at start "
            f"(from {avail['earliest_available_date']})."
        )
    else:
        bits.append(
            f"Availability risk: {avail['fte_gap']} FTE short; frees up "
            f"{avail['earliest_available_date']}."
        )
    bits.append(f"Confidence: {c['confidence']}.")
    return " ".join(str(b) for b in bits if b)


def _ai_explain_candidate(c: dict, role_name: str) -> Optional[str]:
    facts = {
        "role": role_name,
        "name": c["name"],
        "grade": c["grade"],
        "location": c["country"],
        "overall_score": c["overall_score"],
        "matched_required_skills": c["skill_detail"]["matched_required"],
        "missing_required_skills": c["skill_detail"]["missing_required"],
        "domain_evidence": c["domain_detail"]["evidence"],
        "availability": c["availability_detail"],
        "confidence": c["confidence"],
        "risks": c["risks"],
    }
    raw = _chat(
        [
            {
                "role": "system",
                "content": (
                    "You explain workforce staffing recommendations to a manager in "
                    "2-3 concise sentences. Use ONLY the provided facts. Be specific "
                    "about skills, availability and risk. Never invent data."
                ),
            },
            {"role": "user", "content": json.dumps(facts, default=str)},
        ]
    )
    return raw.strip() if raw else None


def explain_option(option: dict, requirement_summary: str) -> str:
    """One-paragraph narrative for a whole staffing option."""
    if config.ai_enabled():
        text = _ai_explain_option(option, requirement_summary)
        if text:
            return text
    return mock_explain_option(option)


def mock_explain_option(option: dict) -> str:
    n = sum(len(a["candidates"]) for a in option["assignments"])
    unfilled = sum(a["unfilled"] for a in option["assignments"])
    parts = [
        f"This is the '{option['label']}' option: {option['description']} "
        f"It proposes {n} candidate(s) with an average match of {option['team_score']}/100 "
        f"and {option['team_confidence'].lower()} overall confidence."
    ]
    if option["earliest_team_start"]:
        parts.append(f"The full team can be in place by {option['earliest_team_start']}.")
    if unfilled:
        parts.append(f"{unfilled} role slot(s) remain unfilled and need attention.")
    return " ".join(str(p) for p in parts)


def _ai_explain_option(option: dict, requirement_summary: str) -> Optional[str]:
    facts = {
        "requirement": requirement_summary,
        "label": option["label"],
        "description": option["description"],
        "team_score": option["team_score"],
        "team_confidence": option["team_confidence"],
        "earliest_team_start": str(option["earliest_team_start"]),
        "assignments": [
            {
                "role": a["role_name"],
                "candidates": [
                    {"name": c["name"], "score": c["overall_score"], "confidence": c["confidence"]}
                    for c in a["candidates"]
                ],
                "unfilled": a["unfilled"],
            }
            for a in option["assignments"]
        ],
    }
    raw = _chat(
        [
            {
                "role": "system",
                "content": (
                    "You summarise a staffing option for a manager in 2-3 sentences, "
                    "noting trade-offs, risks and confidence. Use ONLY the facts given."
                ),
            },
            {"role": "user", "content": json.dumps(facts, default=str)},
        ]
    )
    return raw.strip() if raw else None
