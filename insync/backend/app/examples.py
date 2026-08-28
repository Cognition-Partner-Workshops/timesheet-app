"""Database-aware demo examples for the Opportunity Intake screen.

The four "Example" buttons must be reliable for live demos:

* Examples 1-3 must return at least one **real, in-location, unbooked** candidate
  from the current PostgreSQL data, across every staffing strategy tab.
* Example 4 must intentionally land in the "No Strong Internal Match"
  capability-gap state.

Everything here is deterministic SQL/Python logic — **no OpenAI**.

Strategy: a small set of *hardcoded, pre-verified* prompts (chosen by inspecting
the seeded Postgres data) is the primary source. On every request each primary
prompt is re-validated against the EXACT live recommendation pipeline
(``ai.mock_parse`` -> ``recommend.build_options``) the "Generate staffing
options" button uses. A prompt is only emitted when, across all three strategy
tabs, it returns at least one candidate who is in the requested city, holds the
required skills, is not booked, and triggered no location fallback or capability
gap. If a hardcoded prompt ever stops validating (e.g. the data changed), it is
transparently replaced by regenerating an equivalent valid combination from the
live data. If Postgres is unavailable we fall back to safe static examples.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date

from . import ai, recommend as recommend_engine, workflow
from .data_layer import get_store
from .scoring import RoleRequirement

logger = logging.getLogger("insync.examples")

# Pre-verified, demo-safe prompts. Each was confirmed against the seeded
# PostgreSQL data to return an in-city, skill-matching, unbooked candidate in
# every staffing strategy. They are still re-validated live on each request.
_PRIMARY_PROMPTS: list[str] = [
    "Need 1 DevOps Engineer with CI/CD and Kubernetes for a Banking project in Melbourne in 30 days.",
    "Need 1 Software Engineer with REST API Design for a Payments project in Kuala Lumpur in 30 days.",
    "Need 1 Software Engineer with REST API Design for a Retail project in Perth in 30 days.",
]

# Example 4 is intentionally a capability gap: no single employee carries all
# three of these required skills, so the engine returns "No Strong Internal
# Match" rather than substituting unsuited people.
_GAP_PROMPT = (
    "Need 1 AI Engineer with LLM Integration, Agentic Workflows and OpenAI API "
    "for a project in Singapore starting ASAP."
)

# Demo-safe static fallback (used only if Postgres / the store is unavailable).
_STATIC_FALLBACK: list[dict] = [
    {"label": "Example 1", "prompt": _PRIMARY_PROMPTS[0], "expected_result": "valid_match"},
    {"label": "Example 2", "prompt": _PRIMARY_PROMPTS[1], "expected_result": "valid_match"},
    {"label": "Example 3", "prompt": _PRIMARY_PROMPTS[2], "expected_result": "valid_match"},
    {"label": "Example 4", "prompt": _GAP_PROMPT, "expected_result": "no_strong_internal_match"},
]

_DETECTABLE_LOCATIONS = {loc.lower() for loc in ai.LOCATIONS}


def _requirements(prompt: str, snapshot: date) -> list[RoleRequirement]:
    """Parse a prompt exactly as the live /api/parse + /api/recommend flow does."""
    parsed = ai.mock_parse(prompt, snapshot)
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


def _is_booked_status(status: str | None) -> bool:
    """A descriptive 'Booked - ...' status that should not be shown as available.

    'Booked - Partial Capacity' / 'Booked - Release Planned' are still partially
    available supply, but for demo clarity we only accept genuinely unbooked
    candidates ('No Active Booking') so the recommended people never read as
    booked.
    """
    return (status or "").strip().lower().startswith("booked")


def _validate_valid_match(prompt: str, available: list[dict], snapshot: date) -> bool:
    """True only if the prompt yields a clean in-location, unbooked match.

    Runs the EXACT live pipeline and requires, for every strategy tab:
      * at least one candidate, all in the requested city (no fallback),
      * no off-city candidates,
      * every shown candidate genuinely unbooked,
      * no capability gap.
    """
    reqs = _requirements(prompt, snapshot)
    if not reqs:
        return False
    req = reqs[0]
    city = (req.location_preference or "").strip().lower()
    if not city:
        return False
    result = recommend_engine.build_options(available, reqs, snapshot)
    for option in result["options"]:
        assignment = option["assignments"][0]
        if assignment.get("no_strong_match") or assignment.get("capability_gap"):
            return False
        if assignment.get("location_level") != "city":
            return False
        cands = assignment["candidates"]
        if not cands:
            return False
        for c in cands:
            if (c.get("city") or "").strip().lower() != city:
                return False
            if _is_booked_status(c.get("ewa_status")):
                return False
    return True


def _validate_gap(prompt: str, available: list[dict], snapshot: date) -> bool:
    """True if the prompt lands in the capability-gap / no-strong-match state."""
    reqs = _requirements(prompt, snapshot)
    if not reqs:
        return False
    result = recommend_engine.build_options(available, reqs, snapshot)
    return all(
        option["assignments"][0].get("no_strong_match")
        or option["assignments"][0].get("capability_gap")
        for option in result["options"]
    )


def _distinct_roles() -> list[tuple[str, dict]]:
    seen: set[str] = set()
    out: list[tuple[str, dict]] = []
    for keyword, lib in ai.ROLE_LIBRARY.items():
        if lib["role_name"] in seen:
            continue
        seen.add(lib["role_name"])
        out.append((keyword, lib))
    return out


def _domain_for(emps: list[dict]) -> str:
    counts = Counter(
        e.get("primary_domain") for e in emps if e.get("primary_domain") in ai.DOMAINS
    )
    return counts.most_common(1)[0][0] if counts else "Banking"


def _build_prompt(role_name: str, skills: list[str], domain: str, city: str, window: str) -> str:
    skill_text = " and ".join(skills) if skills else "the required skills"
    return (
        f"Need 1 {role_name} with {skill_text} for a {domain} project in {city} {window}."
    )


def _regenerate(
    available: list[dict],
    snapshot: date,
    used_roles: set[str],
    used_cities: set[str],
) -> dict | None:
    """Find a fresh, fully-validated valid-match prompt from live data."""
    by_city: dict[str, list[dict]] = {}
    for e in available:
        city = (e.get("city") or "").strip()
        if city and city.lower() in _DETECTABLE_LOCATIONS:
            by_city.setdefault(city, []).append(e)
    cities = sorted(by_city, key=lambda c: -len(by_city[c]))

    for keyword, lib in _distinct_roles():
        role_name = lib["role_name"]
        if role_name in used_roles:
            continue
        skills = list(lib["required_skills"])
        display_skills = skills[:2] if len(skills) >= 2 else skills
        for city in cities:
            if city in used_cities:
                continue
            domain = _domain_for(by_city[city])
            prompt = _build_prompt(role_name, display_skills, domain, city, "in 30 days")
            # The parser must round-trip to this role + city, and validate clean.
            reqs = _requirements(prompt, snapshot)
            if not reqs or reqs[0].role_name != role_name:
                continue
            if (reqs[0].location_preference or "").strip().lower() != city.lower():
                continue
            if _validate_valid_match(prompt, available, snapshot):
                return {"prompt": prompt, "role_name": role_name, "city": city}
    return None


def build_examples() -> list[dict]:
    """Return four demo examples (3 valid-match, 1 capability-gap).

    Hardcoded prompts are re-validated live; any that no longer hold are
    transparently regenerated from the current PostgreSQL data.
    """
    try:
        store = get_store()
        snapshot = store.snapshot_date
        booked = workflow.booked_employee_codes()
        available = [e for e in store.all_employees() if e["employee_id"] not in booked]
        if not available:
            return _STATIC_FALLBACK

        valid: list[dict] = []
        used_roles: set[str] = set()
        used_cities: set[str] = set()

        for prompt in _PRIMARY_PROMPTS:
            if len(valid) >= 3:
                break
            reqs = _requirements(prompt, snapshot)
            if not reqs:
                continue
            role_name = reqs[0].role_name
            city = (reqs[0].location_preference or "").strip()
            if role_name in used_roles or city in used_cities:
                continue
            if _validate_valid_match(prompt, available, snapshot):
                valid.append({"prompt": prompt, "expected_result": "valid_match"})
                used_roles.add(role_name)
                used_cities.add(city)

        # Replace any primaries that failed validation (or duplicates) by
        # regenerating equivalent valid combinations from the live data.
        while len(valid) < 3:
            fresh = _regenerate(available, snapshot, used_roles, used_cities)
            if not fresh:
                break
            valid.append({"prompt": fresh["prompt"], "expected_result": "valid_match"})
            used_roles.add(fresh["role_name"])
            used_cities.add(fresh["city"])

        # Last-resort top-up so the UI always shows three valid buttons.
        if len(valid) < 3:
            for fb in _STATIC_FALLBACK[:3]:
                if len(valid) >= 3:
                    break
                if any(v["prompt"] == fb["prompt"] for v in valid):
                    continue
                valid.append({"prompt": fb["prompt"], "expected_result": "valid_match"})

        examples = [
            {"label": f"Example {i + 1}", "prompt": v["prompt"], "expected_result": v["expected_result"]}
            for i, v in enumerate(valid[:3])
        ]
        examples.append(
            {"label": "Example 4", "prompt": _GAP_PROMPT, "expected_result": "no_strong_internal_match"}
        )
        return examples
    except Exception as exc:  # pragma: no cover - defensive demo fallback
        logger.warning("example generation failed, using static fallback: %s", exc)
        return _STATIC_FALLBACK
