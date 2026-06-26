"""Deterministic candidate scoring engine.

This is the decision-maker of InSync. Given a structured role requirement it
ranks employees with a transparent weighted score so that **the engine picks
candidates first** and AI is only used afterwards to explain the result.

Weights (from the hackathon brief):
    Skill match           35%
    Availability match    25%
    Domain experience     15%
    Location match        10%
    Grade / seniority     10%
    Relevant project hist  5%

Every component returns a 0-1 score plus human-readable evidence so the UI and
the AI explainer can cite concrete facts rather than guessing.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from . import availability

WEIGHTS = {
    "skill": 0.35,
    "availability": 0.25,
    "domain": 0.15,
    "location": 0.10,
    "grade": 0.10,
    "project_history": 0.05,
}

# Grade taxonomy -> numeric seniority (mirrors People.CareerLevel).
GRADE_LEVEL = {
    "associate consultant": 1,
    "consultant": 2,
    "senior consultant": 3,
    "lead consultant": 4,
    "manager": 5,
    "senior manager": 6,
    "principal consultant": 7,
}


@dataclass
class RoleRequirement:
    """A single role to staff, normalised for the scoring engine."""

    role_name: str
    required_skills: list[str] = field(default_factory=list)
    desired_skills: list[str] = field(default_factory=list)
    domain: Optional[str] = None
    location_preference: Optional[str] = None
    grade_preference: Optional[str] = None
    start_date: Optional[date] = None
    fte_required: float = 1.0
    count: int = 1


# ----------------------------------------------------------------- utilities
def _norm(text: Optional[str]) -> str:
    return (text or "").strip().lower()


def _skill_matches(required: str, owned: str) -> bool:
    """Loose, case-insensitive skill match (handles minor naming variance)."""
    r, o = _norm(required), _norm(owned)
    if not r or not o:
        return False
    return r == o or r in o or o in r


# ----------------------------------------------------------------- components
def score_skills(emp: dict, req: RoleRequirement) -> dict:
    """Skill match weighted toward required skills, with a desired-skill bonus."""
    owned = emp.get("skills", [])
    owned_names = [s["name"] for s in owned if s.get("name")]

    matched_required, missing_required = [], []
    for skill in req.required_skills:
        if any(_skill_matches(skill, o) for o in owned_names):
            matched_required.append(skill)
        else:
            missing_required.append(skill)

    matched_desired = [
        skill
        for skill in req.desired_skills
        if any(_skill_matches(skill, o) for o in owned_names)
    ]

    req_total = len(req.required_skills)
    des_total = len(req.desired_skills)
    req_ratio = (len(matched_required) / req_total) if req_total else 1.0
    des_ratio = (len(matched_desired) / des_total) if des_total else 0.0

    # Required skills dominate; desired skills can only top up the score.
    score = round(0.85 * req_ratio + 0.15 * des_ratio, 4)

    return {
        "score": score,
        "matched_required": matched_required,
        "missing_required": missing_required,
        "matched_desired": matched_desired,
        "required_total": req_total,
        "desired_total": des_total,
    }


def score_domain(emp: dict, req: RoleRequirement) -> dict:
    """Domain experience from primary/secondary domain and project history."""
    if not req.domain:
        return {"score": 0.6, "evidence": "No specific domain required."}
    target = _norm(req.domain)
    primary = _norm(emp.get("primary_domain"))
    secondary = _norm(emp.get("secondary_domain"))

    if target and target == primary:
        return {"score": 1.0, "evidence": f"Primary domain is {emp['primary_domain']}."}
    if target and target == secondary:
        return {"score": 0.7, "evidence": f"Secondary domain is {emp['secondary_domain']}."}

    # Fall back to evidence in project history.
    for hist in emp.get("project_history", []):
        if target and target == _norm(hist.get("domain")):
            return {
                "score": 0.55,
                "evidence": f"Delivered {hist.get('project_name')} in {hist.get('domain')}.",
            }
    return {"score": 0.1, "evidence": "No direct domain experience evidenced."}


def score_location(emp: dict, req: RoleRequirement) -> dict:
    """Match candidate country/region/timezone against the role preference."""
    pref = _norm(req.location_preference)
    if not pref:
        return {"score": 0.7, "evidence": "No location constraint."}

    country = _norm(emp.get("country"))
    region = _norm(emp.get("region"))
    city = _norm(emp.get("city"))
    timezone = _norm(emp.get("timezone"))

    if country and country in pref:
        return {"score": 1.0, "evidence": f"Based in {emp.get('country')}."}
    if region and region in pref:
        return {"score": 0.8, "evidence": f"In preferred region {emp.get('region')}."}
    if city and city in pref:
        return {"score": 0.9, "evidence": f"Based in {emp.get('city')}."}
    if timezone and any(tok and tok in pref for tok in timezone.split("/")):
        return {"score": 0.7, "evidence": f"Timezone overlap ({emp.get('timezone')})."}
    # Remote-friendly roles still get partial credit.
    if "remote" in pref or "regional" in pref:
        return {"score": 0.5, "evidence": "Remote / regional delivery acceptable."}
    return {"score": 0.25, "evidence": f"Located in {emp.get('country')} (outside preference)."}


def score_grade(emp: dict, req: RoleRequirement) -> dict:
    """Seniority fit using numeric distance between grades."""
    if not req.grade_preference:
        return {"score": 0.7, "evidence": "No grade preference."}
    want = GRADE_LEVEL.get(_norm(req.grade_preference))
    have_level = emp.get("career_level")
    have = have_level if isinstance(have_level, (int, float)) else GRADE_LEVEL.get(_norm(emp.get("grade")))
    if want is None or have is None:
        return {"score": 0.6, "evidence": "Grade not comparable."}

    distance = abs(int(have) - want)
    if distance == 0:
        score = 1.0
    elif have > want:  # more senior than required is usually acceptable
        score = 0.85 if distance == 1 else 0.7
    else:  # more junior than required
        score = 0.6 if distance == 1 else 0.3
    return {
        "score": round(score, 4),
        "evidence": f"{emp.get('grade')} vs preferred {req.grade_preference}.",
    }


def score_project_history(emp: dict, req: RoleRequirement) -> dict:
    """Relevant project history: domain + required-skill / tech overlap."""
    history = emp.get("project_history", [])
    if not history:
        return {"score": 0.0, "evidence": "No project history on record."}

    target_domain = _norm(req.domain)
    req_skills = [_norm(s) for s in req.required_skills]
    best = 0.0
    best_evidence = "Relevant delivery experience available."
    for hist in history:
        local = 0.0
        if target_domain and target_domain == _norm(hist.get("domain")):
            local += 0.6
        techs = [_norm(t) for t in hist.get("technologies", [])]
        if any(rs and any(rs in t or t in rs for t in techs) for rs in req_skills):
            local += 0.4
        if _norm(req.role_name) and _norm(req.role_name) in _norm(hist.get("role")):
            local += 0.2
        local = min(local, 1.0)
        if local > best:
            best = local
            best_evidence = (
                f"{hist.get('role')} on {hist.get('project_name')} "
                f"({hist.get('domain')})."
            )
    if best < 1e-9:
        best = 0.2  # has history, just not directly relevant
        best_evidence = "Has delivery history, limited direct relevance."
    return {"score": round(best, 4), "evidence": best_evidence}


# ------------------------------------------------------------------- compose
def score_candidate(emp: dict, req: RoleRequirement, snapshot: date) -> dict:
    """Produce the full weighted scorecard for one employee against one role."""
    required_start = req.start_date or snapshot

    skills = score_skills(emp, req)
    avail = availability.availability_fit(emp, required_start, req.fte_required, snapshot)
    domain = score_domain(emp, req)
    location = score_location(emp, req)
    grade = score_grade(emp, req)
    history = score_project_history(emp, req)

    components = {
        "skill": skills["score"],
        "availability": avail["score"],
        "domain": domain["score"],
        "location": location["score"],
        "grade": grade["score"],
        "project_history": history["score"],
    }
    overall = sum(components[k] * WEIGHTS[k] for k in WEIGHTS)
    overall_100 = round(overall * 100, 1)

    confidence = _confidence(overall_100, emp, avail, skills)
    risks = _risks(emp, avail, skills, location, grade)
    next_actions = _next_actions(emp, avail, skills)

    return {
        "employee_id": emp["employee_id"],
        "name": emp.get("name"),
        "role_archetype": emp.get("role_archetype"),
        "grade": emp.get("grade"),
        "country": emp.get("country"),
        "region": emp.get("region"),
        "city": emp.get("city"),
        "primary_domain": emp.get("primary_domain"),
        "secondary_domain": emp.get("secondary_domain"),
        "availability_category": emp.get("availability_category"),
        "ewa_status": emp.get("ewa_status"),
        "work_mode": emp.get("work_mode"),
        "overall_score": overall_100,
        "components": {k: round(v * 100, 1) for k, v in components.items()},
        "weighted_contributions": {
            k: round(components[k] * WEIGHTS[k] * 100, 1) for k in WEIGHTS
        },
        "skill_detail": skills,
        "availability_detail": avail,
        "domain_detail": domain,
        "location_detail": location,
        "grade_detail": grade,
        "project_history_detail": history,
        "confidence": confidence,
        "risks": risks,
        "next_actions": next_actions,
    }


def _confidence(overall: float, emp: dict, avail: dict, skills: dict) -> str:
    """High / Medium / Low confidence from score, availability and booking."""
    booked = availability.is_booked(emp)
    missing = len(skills["missing_required"])
    if booked or not avail["covers_start"]:
        base = "Low"
    elif overall >= 75 and missing == 0:
        base = "High"
    elif overall >= 55:
        base = "Medium"
    else:
        base = "Low"
    return base


def _risks(emp: dict, avail: dict, skills: dict, location: dict, grade: dict) -> list[str]:
    risks: list[str] = []
    if availability.is_booked(emp):
        risks.append("Currently booked - only viable as a low-confidence stretch option.")
    if not avail["covers_start"]:
        risks.append(
            f"Availability gap of {avail['fte_gap']} FTE at the proposed start date."
        )
    elif avail["days_late"] > 0:
        risks.append(f"Frees up {avail['days_late']} day(s) after the requested start.")
    if skills["missing_required"]:
        risks.append("Missing required skills: " + ", ".join(skills["missing_required"]) + ".")
    if location["score"] < 0.5:
        risks.append("Location is outside the role's preference.")
    if grade["score"] < 0.5:
        risks.append("Seniority is below the preferred grade.")
    if not risks:
        risks.append("No material risks identified.")
    return risks


def _next_actions(emp: dict, avail: dict, skills: dict) -> list[str]:
    actions: list[str] = []
    if availability.is_booked(emp):
        actions.append("Confirm release feasibility with the current delivery manager.")
    elif avail["covers_start"]:
        actions.append("Create an EWA proposal to reserve capacity.")
    else:
        actions.append("Resolve the availability gap or consider a later start / split.")
    if skills["missing_required"]:
        actions.append("Validate missing skills or pair with a stronger team member.")
    actions.append("Review candidate profile and project evidence before booking.")
    return actions


def rank_candidates(
    employees: list[dict],
    req: RoleRequirement,
    snapshot: date,
    limit: int = 25,
) -> list[dict]:
    """Score and rank all employees for a role (best overall first)."""
    scored = [score_candidate(emp, req, snapshot) for emp in employees]
    scored.sort(key=lambda c: c["overall_score"], reverse=True)
    return scored[:limit]
