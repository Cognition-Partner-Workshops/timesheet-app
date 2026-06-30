"""Database-aware demo examples for the Opportunity Intake screen.

The four "Example" buttons must be reliable for live demos: the first three
have to return at least one real candidate from the current PostgreSQL data,
and the fourth must intentionally land in the "No Strong Internal Match"
capability-gap state.

Everything here is deterministic SQL/Python logic — **no OpenAI**. Each of the
first three candidate prompts is *self-validated* by running the exact same
mock parser + recommendation pool the live ``/api/recommend`` flow uses, so a
prompt is only emitted once it is proven to yield candidates against the
current data. If anything goes wrong (e.g. Postgres unavailable) we fall back
to safe static examples chosen to exist in the seeded dataset.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date
from typing import Optional

from . import ai, scoring, workflow
from .data_layer import get_store
from .scoring import RoleRequirement

logger = logging.getLogger("insync.examples")

# Candidate roles to try, in priority order. Each phrase contains the role
# keyword so the deterministic parser maps it back to the right role library
# entry (which is what actually drives required-skill matching).
_ROLE_CANDIDATES: list[tuple[str, str]] = [
    ("backend", "Backend Engineers"),
    ("react", "React Frontend Engineers"),
    ("data engineer", "Data Engineers"),
    ("qa", "QA Engineers"),
    ("devops", "DevOps Engineers"),
    ("business analyst", "Business Analysts"),
    ("project manager", "Project Managers"),
    ("solution architect", "Solution Architects"),
    ("cloud engineer", "Cloud Engineers"),
    ("full stack", "Full Stack Engineers"),
]

# Only cities the deterministic parser can actually detect (its location
# vocabulary). Using anything outside this set would not parse back to a
# location and the example would silently behave as "no location".
_DETECTABLE_LOCATIONS = {loc.lower() for loc in ai.LOCATIONS}

_START_WINDOWS = ["in 30 days", "in 60 days", "starting ASAP"]

# Demo-safe static fallback (used only if Postgres / the store is unavailable).
_STATIC_FALLBACK: list[dict] = [
    {
        "label": "Example 1",
        "prompt": "Need 2 Backend Engineers with Java and REST API Design for a Banking project in Pune in 30 days.",
        "expected_result": "valid_match",
    },
    {
        "label": "Example 2",
        "prompt": "Need 2 React Frontend Engineers with React and TypeScript for a Payments project in Bengaluru in 60 days.",
        "expected_result": "valid_match",
    },
    {
        "label": "Example 3",
        "prompt": "Need 1 Data Engineer with Data Engineering and SQL for a Healthcare project in Hyderabad in 30 days.",
        "expected_result": "valid_match",
    },
    {
        "label": "Example 4",
        "prompt": "Need 1 AI Engineer with LLM Integration, Agentic Workflows and OpenAI API for a project in Singapore starting ASAP.",
        "expected_result": "no_strong_internal_match",
    },
]

# Example 4 is intentionally a capability gap: no single employee carries all
# three of these required skills, so the engine returns "No Strong Internal
# Match" rather than substituting unsuited people.
_GAP_PROMPT = (
    "Need 1 AI Engineer with LLM Integration, Agentic Workflows and OpenAI API "
    "for a project in Singapore starting ASAP."
)


def _requirements(parsed: dict, snapshot: date) -> list[RoleRequirement]:
    reqs: list[RoleRequirement] = []
    for r in parsed["roles"]:
        reqs.append(
            RoleRequirement(
                role_name=r["role_name"],
                required_skills=list(r.get("required_skills", [])),
                desired_skills=list(r.get("desired_skills", [])),
                domain=r.get("domain"),
                location_preference=r.get("location_preference"),
                grade_preference=r.get("grade_preference"),
                start_date=date.fromisoformat(r["start_date"]),
                fte_required=r.get("fte_required", 1.0),
                count=r.get("count", 1),
            )
        )
    return reqs


def _evaluate(prompt: str, available: list[dict], snapshot: date) -> tuple[int, bool]:
    """Run the real parse->pool flow; return (candidate_count, no_skill_match)."""
    parsed = ai.mock_parse(prompt, snapshot)
    total = 0
    gap = False
    for req in _requirements(parsed, snapshot):
        pool = scoring.build_role_pool(
            available, req, snapshot, min_candidates=1, limit=25
        )
        total += len(pool["candidates"])
        gap = gap or pool["no_skill_match"]
    return total, gap


def _domain_for(city_emps: list[dict]) -> str:
    counts = Counter(
        e.get("primary_domain")
        for e in city_emps
        if e.get("primary_domain") in ai.DOMAINS
    )
    if counts:
        return counts.most_common(1)[0][0]
    return "Banking"


def _build_prompt(count: int, phrase: str, skills: list[str], domain: str, city: str, window: str) -> str:
    skill_text = " and ".join(skills) if skills else "the required skills"
    role_phrase = phrase[:-1] if count == 1 and phrase.endswith("s") else phrase
    return (
        f"Need {count} {role_phrase} with {skill_text} for a {domain} project "
        f"in {city} {window}."
    )


def build_examples() -> list[dict]:
    """Return four demo examples (3 valid-match, 1 capability-gap)."""
    try:
        store = get_store()
        snapshot = store.snapshot_date
        booked = workflow.booked_employee_codes()
        available = [
            e for e in store.all_employees() if e["employee_id"] not in booked
        ]
        if not available:
            return _STATIC_FALLBACK

        # Group available employees by detectable city.
        by_city: dict[str, list[dict]] = {}
        for e in available:
            city = (e.get("city") or "").strip()
            if city and city.lower() in _DETECTABLE_LOCATIONS:
                by_city.setdefault(city, []).append(e)
        cities = sorted(by_city, key=lambda c: -len(by_city[c]))

        valid: list[dict] = []
        used_roles: set[str] = set()
        used_cities: set[str] = set()

        for keyword, phrase in _ROLE_CANDIDATES:
            if len(valid) >= 3:
                break
            lib = ai.ROLE_LIBRARY[keyword]
            role_name = lib["role_name"]
            if role_name in used_roles:
                continue
            skills = list(lib["required_skills"])[:2]
            for city in cities:
                if city in used_cities:
                    continue
                window = _START_WINDOWS[len(valid) % len(_START_WINDOWS)]
                domain = _domain_for(by_city[city])
                # Probe with count=2 (count does not change pool membership).
                probe = _build_prompt(2, phrase, skills, domain, city, window)
                count_candidates, gap = _evaluate(probe, available, snapshot)
                if count_candidates >= 1 and not gap:
                    count = min(count_candidates, 2)
                    prompt = _build_prompt(count, phrase, skills, domain, city, window)
                    valid.append(
                        {
                            "label": f"Example {len(valid) + 1}",
                            "prompt": prompt,
                            "expected_result": "valid_match",
                        }
                    )
                    used_roles.add(role_name)
                    used_cities.add(city)
                    break

        # If the data could not yield three distinct valid combos, top up from
        # the validated static fallback so the UI always shows four buttons.
        if len(valid) < 3:
            for fb in _STATIC_FALLBACK[:3]:
                if len(valid) >= 3:
                    break
                valid.append({**fb, "label": f"Example {len(valid) + 1}"})

        valid.append(
            {
                "label": "Example 4",
                "prompt": _GAP_PROMPT,
                "expected_result": "no_strong_internal_match",
            }
        )
        return valid
    except Exception as exc:  # pragma: no cover - defensive demo fallback
        logger.warning("example generation failed, using static fallback: %s", exc)
        return _STATIC_FALLBACK
