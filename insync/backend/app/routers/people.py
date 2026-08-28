"""People search & detail endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..data_layer import CAT_BENCH, get_store

router = APIRouter(prefix="/api", tags=["people"])


def _summary(emp: dict) -> dict:
    """Compact employee record for list views."""
    return {
        "employee_id": emp["employee_id"],
        "name": emp.get("name"),
        "role_archetype": emp.get("role_archetype"),
        "department": emp.get("department"),
        "discipline": emp.get("discipline"),
        "grade": emp.get("grade"),
        "region": emp.get("region"),
        "country": emp.get("country"),
        "city": emp.get("city"),
        "primary_domain": emp.get("primary_domain"),
        "secondary_domain": emp.get("secondary_domain"),
        "availability_category": emp.get("availability_category"),
        "available_fte_current": emp.get("available_fte_current"),
        "expected_release_date": emp.get("expected_release_date"),
        "ewa_status": emp.get("ewa_status"),
        "work_mode": emp.get("work_mode"),
        "top_skills": [s["name"] for s in emp.get("skills", [])[:6] if s.get("name")],
    }


@router.get("/people")
def search_people(
    skill: Optional[str] = Query(None, description="Skill name (loose match)"),
    role: Optional[str] = Query(None, description="Role archetype"),
    grade: Optional[str] = None,
    region: Optional[str] = None,
    country: Optional[str] = Query(None, description="Country or city"),
    domain: Optional[str] = None,
    availability: Optional[str] = Query(None, description="AvailabilityCategory"),
    bench_only: bool = False,
    q: Optional[str] = Query(None, description="Free-text name / ID search"),
    limit: int = 100,
) -> dict:
    store = get_store()
    results = []
    for emp in store.all_employees():
        if skill:
            owned = [s["name"].lower() for s in emp.get("skills", []) if s.get("name")]
            sk = skill.lower()
            if not any(sk in name or name in sk for name in owned):
                continue
        if role and (emp.get("role_archetype") or "").lower() != role.lower():
            continue
        if grade and (emp.get("grade") or "").lower() != grade.lower():
            continue
        if region and (emp.get("region") or "").lower() != region.lower():
            continue
        if country:
            c = country.lower()
            if c not in (emp.get("country") or "").lower() and c not in (emp.get("city") or "").lower():
                continue
        if domain:
            d = domain.lower()
            if d not in (emp.get("primary_domain") or "").lower() and d not in (emp.get("secondary_domain") or "").lower():
                continue
        if availability and (emp.get("availability_category") or "") != availability:
            continue
        if bench_only and emp.get("availability_category") != CAT_BENCH:
            continue
        if q:
            ql = q.lower()
            if ql not in (emp.get("name") or "").lower() and ql not in emp["employee_id"].lower():
                continue
        results.append(_summary(emp))

    results.sort(key=lambda r: (r["availability_category"] or "z", r["name"] or ""))
    return {"total": len(results), "results": results[:limit]}


@router.get("/people/{employee_id}")
def person_detail(employee_id: str) -> dict:
    store = get_store()
    emp = store.get_employee(employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    calendar = [
        {
            "week_start": row["week_start"].isoformat() if row["week_start"] else None,
            "available_fte": row["available_fte"],
            "type": row["type"],
        }
        for row in store.availability_calendar(employee_id)
    ]
    # Return a JSON-safe copy of the enriched employee record.
    detail = dict(emp)
    detail["expected_release_date"] = (
        emp["expected_release_date"].isoformat() if emp.get("expected_release_date") else None
    )
    detail["availability_calendar"] = calendar
    detail["skills"] = [
        {**s, "last_used": s["last_used"].isoformat() if s.get("last_used") else None}
        for s in emp.get("skills", [])
    ]
    detail["project_history"] = [
        {
            **h,
            "start_date": h["start_date"].isoformat() if h.get("start_date") else None,
            "end_date": h["end_date"].isoformat() if h.get("end_date") else None,
        }
        for h in emp.get("project_history", [])
    ]
    if detail.get("bench") and detail["bench"].get("available_from"):
        detail["bench"] = {
            **detail["bench"],
            "available_from": detail["bench"]["available_from"].isoformat(),
        }
    return detail
