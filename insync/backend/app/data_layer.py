"""Data access layer for the InSync Workforce Planning Assistant.

Reads every relevant sheet of the workforce Excel workbook with pandas and
stitches the records together using the documented join keys:

    * Employee_ID          - links People, Skills, Profiles, Project History,
                             Bench, Allocations, Availability Calendar, Overlays
                             and EWA Requests.
    * Opportunity_ID       - links Opportunities -> Opportunity Roles ->
                             Overlays / EWA Requests.
    * Opportunity_Role_ID  - links Opportunity Roles -> Overlays / EWA Requests.

The store is loaded once at process start and exposed as an in-memory object so
the API stays fast and deterministic. Everything here is read-only with respect
to the source workbook; the mock EWA submission is kept in a separate in-memory
list (see routers/ewa.py).
"""
from __future__ import annotations

import math
from datetime import date, datetime
from functools import lru_cache
from typing import Any, Optional

import pandas as pd

from . import config


# Availability categories used consistently across the dataset.
CAT_BENCH = "Current Bench"
CAT_PARTIAL = "Partial Capacity"
CAT_ROLL_30 = "Rolling Off 0-30"
CAT_ROLL_60 = "Rolling Off 31-60"
CAT_ROLL_90 = "Rolling Off 61-90"
CAT_ALLOCATED = "Allocated >90"


def _clean(value: Any) -> Any:
    """Convert pandas NaN/NaT to None and trim strings for JSON safety."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if value is pd.NaT:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def _to_date(value: Any) -> Optional[date]:
    """Parse a cell into a date, tolerating strings, Timestamps and blanks."""
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        ts = pd.to_datetime(value, errors="coerce")
        return None if pd.isna(ts) else ts.date()
    except (ValueError, TypeError):
        return None


def _split_list(value: Any) -> list[str]:
    """Split a semicolon/comma separated cell into a clean list of tokens."""
    value = _clean(value)
    if not value:
        return []
    raw = str(value).replace(",", ";")
    return [token.strip() for token in raw.split(";") if token.strip()]


class DataStore:
    """In-memory representation of the whole workforce workbook."""

    def __init__(self, data_file: str | None = None) -> None:
        self.path = data_file or str(config.DATA_FILE)
        self.snapshot_date: date = config.SNAPSHOT_DATE
        self._load()
        self._build_indexes()

    # ------------------------------------------------------------------ load
    def _load(self) -> None:
        xls = pd.ExcelFile(self.path)
        self._sheets = {name: xls.parse(name) for name in xls.sheet_names}
        # Frequently used frames (defensive .get keeps it resilient to renames).
        self.people = self._sheets.get("People", pd.DataFrame())
        self.skills = self._sheets.get("Skills", pd.DataFrame())
        self.skill_catalog = self._sheets.get("Skill Catalog", pd.DataFrame())
        self.profiles = self._sheets.get("Profiles", pd.DataFrame())
        self.allocations = self._sheets.get("Allocations", pd.DataFrame())
        self.bench = self._sheets.get("Bench", pd.DataFrame())
        self.partial_capacity = self._sheets.get("Partial Capacity", pd.DataFrame())
        self.availability = self._sheets.get("Availability Calendar", pd.DataFrame())
        self.bench_movement = self._sheets.get("Bench Movement", pd.DataFrame())
        self.project_history = self._sheets.get("Project History", pd.DataFrame())
        self.opportunities = self._sheets.get("Opportunities", pd.DataFrame())
        self.opportunity_roles = self._sheets.get("Opportunity Roles", pd.DataFrame())
        self.overlays = self._sheets.get("Opportunity Overlays", pd.DataFrame())
        self.ewa_requests = self._sheets.get("EWA Requests", pd.DataFrame())
        self.starter_prompts = self._sheets.get("Starter Prompts", pd.DataFrame())

    def _build_indexes(self) -> None:
        # Skills grouped by employee.
        self._skills_by_emp: dict[str, list[dict]] = {}
        for _, row in self.skills.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._skills_by_emp.setdefault(emp, []).append(
                {
                    "name": _clean(row.get("SkillName")),
                    "category": _clean(row.get("SkillCategory")),
                    "level": _clean(row.get("SkillLevel")),
                    "years": _clean(row.get("YearsExperience")),
                    "last_used": _to_date(row.get("LastUsedDate")),
                    "evidence": _clean(row.get("EvidenceSource")),
                    "confidence": _clean(row.get("Confidence")),
                }
            )

        # Profiles keyed by employee.
        self._profile_by_emp: dict[str, dict] = {}
        for _, row in self.profiles.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._profile_by_emp[emp] = {
                "summary": _clean(row.get("ProfileSummary")),
                "key_strengths": _split_list(row.get("KeyStrengths")),
                "preferred_work_types": _clean(row.get("PreferredWorkTypes")),
                "domain_experience": _clean(row.get("DomainExperienceSummary")),
                "certifications": _split_list(row.get("Certifications")),
                "recent_highlights": _clean(row.get("RecentHighlights")),
                "mobility_notes": _clean(row.get("MobilityNotes")),
                "languages": _split_list(row.get("Languages")),
            }

        # Project history grouped by employee.
        self._history_by_emp: dict[str, list[dict]] = {}
        for _, row in self.project_history.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._history_by_emp.setdefault(emp, []).append(
                {
                    "client_name": _clean(row.get("Client_Name")),
                    "client_type": _clean(row.get("Client_Type")),
                    "project_name": _clean(row.get("Project_Name")),
                    "domain": _clean(row.get("Domain")),
                    "role": _clean(row.get("Role")),
                    "start_date": _to_date(row.get("StartDate")),
                    "end_date": _to_date(row.get("EndDate")),
                    "technologies": _split_list(row.get("KeyTechnologiesOrMethods")),
                    "responsibilities": _clean(row.get("Responsibilities")),
                    "outcome": _clean(row.get("OutcomeEvidence")),
                    "region": _clean(row.get("Region")),
                    "team_size": _clean(row.get("TeamSize")),
                }
            )

        # Bench rows keyed by employee (canonical supply records only).
        self._bench_by_emp: dict[str, dict] = {}
        for _, row in self.bench.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._bench_by_emp[emp] = {
                "bench_type": _clean(row.get("BenchType")),
                "available_from": _to_date(row.get("AvailableFrom")),
                "bench_fte": _clean(row.get("BenchFTE")),
                "bench_risk": _clean(row.get("BenchRisk")),
                "time_on_bench_days": _clean(row.get("TimeOnBenchDays")),
                "suggested_action": _clean(row.get("SuggestedAction")),
                "target_role_fit": _clean(row.get("TargetRoleFit")),
                "ewa_action_required": _clean(row.get("EWAActionRequired")),
                "top_skills": _split_list(row.get("TopSkills")),
            }

        # Availability calendar grouped by employee (sorted by week).
        self._availability_by_emp: dict[str, list[dict]] = {}
        for _, row in self.availability.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._availability_by_emp.setdefault(emp, []).append(
                {
                    "week_start": _to_date(row.get("WeekStartDate")),
                    "available_fte": _clean(row.get("AvailableFTE")) or 0.0,
                    "type": _clean(row.get("AvailabilityType")),
                    "confidence": _clean(row.get("Confidence")),
                }
            )
        for rows in self._availability_by_emp.values():
            rows.sort(key=lambda r: r["week_start"] or date.max)

        # People keyed by employee, enriched with everything above.
        self._employees: dict[str, dict] = {}
        for _, row in self.people.iterrows():
            emp = _clean(row.get("Employee_ID"))
            if not emp:
                continue
            self._employees[emp] = self._build_employee(emp, row)

    # ---------------------------------------------------------- employee build
    def _build_employee(self, emp_id: str, row: pd.Series) -> dict:
        skills = self._skills_by_emp.get(emp_id, [])
        bench = self._bench_by_emp.get(emp_id)
        return {
            "employee_id": emp_id,
            "name": _clean(row.get("Employee_Name")),
            "region": _clean(row.get("Region")),
            "country": _clean(row.get("Country")),
            "city": _clean(row.get("City")),
            "timezone": _clean(row.get("Timezone")),
            "department": _clean(row.get("Department")),
            "discipline": _clean(row.get("Discipline")),
            "role_archetype": _clean(row.get("RoleArchetype")),
            "grade": _clean(row.get("Grade")),
            "career_level": _clean(row.get("CareerLevel")),
            "primary_domain": _clean(row.get("PrimaryDomain")),
            "secondary_domain": _clean(row.get("SecondaryDomain")),
            "availability_category": _clean(row.get("AvailabilityCategory")),
            "current_allocation_fte": _clean(row.get("CurrentAllocationFTE")) or 0.0,
            "available_fte_current": _clean(row.get("AvailableFTECurrent")) or 0.0,
            "expected_release_date": _to_date(row.get("ExpectedReleaseDate")),
            "release_window": _clean(row.get("ReleaseWindow")),
            "ewa_status": _clean(row.get("EWAStatus")),
            "current_account_id": _clean(row.get("CurrentAccountID")),
            "current_project_id": _clean(row.get("CurrentProjectID")),
            "current_role": _clean(row.get("CurrentRole")),
            "work_mode": _clean(row.get("WorkMode")),
            "skills": skills,
            "profile": self._profile_by_emp.get(emp_id),
            "project_history": self._history_by_emp.get(emp_id, []),
            "bench": bench,
        }

    # -------------------------------------------------------------- accessors
    def all_employees(self) -> list[dict]:
        return list(self._employees.values())

    def get_employee(self, emp_id: str) -> Optional[dict]:
        return self._employees.get(emp_id)

    def availability_calendar(self, emp_id: str) -> list[dict]:
        return self._availability_by_emp.get(emp_id, [])

    def all_opportunities(self) -> list[dict]:
        out = []
        for _, row in self.opportunities.iterrows():
            opp_id = _clean(row.get("Opportunity_ID"))
            if not opp_id:
                continue
            out.append(
                {
                    "opportunity_id": opp_id,
                    "name": _clean(row.get("Opportunity_Name")),
                    "client_name": _clean(row.get("Client_Name")),
                    "client_type": _clean(row.get("Client_Type")),
                    "region": _clean(row.get("Region")),
                    "country": _clean(row.get("Country")),
                    "city": _clean(row.get("City")),
                    "domain": _clean(row.get("Domain")),
                    "stage": _clean(row.get("Stage")),
                    "probability": _clean(row.get("Probability")),
                    "expected_start_date": _to_date(row.get("ExpectedStartDate")),
                    "duration_weeks": _clean(row.get("DurationWeeks")),
                    "commercial_priority": _clean(row.get("CommercialPriority")),
                    "delivery_risk": _clean(row.get("DeliveryRisk")),
                    "brief": _clean(row.get("OpportunityBrief")),
                    "timezone_preference": _clean(row.get("TimezonePreference")),
                    "roles": self.roles_for_opportunity(opp_id),
                }
            )
        return out

    def roles_for_opportunity(self, opp_id: str) -> list[dict]:
        out = []
        for _, row in self.opportunity_roles.iterrows():
            if _clean(row.get("Opportunity_ID")) != opp_id:
                continue
            out.append(self._role_record(row))
        return out

    def _role_record(self, row: pd.Series) -> dict:
        return {
            "opportunity_role_id": _clean(row.get("Opportunity_Role_ID")),
            "opportunity_id": _clean(row.get("Opportunity_ID")),
            "role_name": _clean(row.get("RoleName")),
            "discipline": _clean(row.get("DisciplineOrDepartment")),
            "grade_preference": _clean(row.get("GradePreference")),
            "required_skills": _split_list(row.get("RequiredSkills")),
            "desired_skills": _split_list(row.get("DesiredSkills")),
            "domain": _clean(row.get("DomainExperienceRequired")),
            "location_preference": _clean(row.get("LocationPreference")),
            "start_date": _to_date(row.get("StartDate")),
            "duration_weeks": _clean(row.get("DurationWeeks")),
            "fte_required": _clean(row.get("FTERequired")) or 1.0,
            "priority": _clean(row.get("Priority")),
            "flexibility_notes": _clean(row.get("FlexibilityNotes")),
            "minimum_individual_fte": _clean(row.get("MinimumIndividualFTE")),
            "can_combine_candidates": _clean(row.get("CanCombineCandidates")),
        }

    def starter_prompt_list(self) -> list[dict]:
        out = []
        for _, row in self.starter_prompts.iterrows():
            prompt = _clean(row.get("Prompt"))
            if not prompt:
                continue
            out.append(
                {
                    "id": _clean(row.get("Prompt_ID")),
                    "persona": _clean(row.get("User_Persona")),
                    "prompt": prompt,
                    "expected_output": _clean(row.get("ExpectedOutput")),
                }
            )
        return out

    # --------------------------------------------------- catalog / vocabulary
    def skill_vocabulary(self) -> list[str]:
        names: set[str] = set()
        for col, frame in (("SkillName", self.skill_catalog), ("SkillName", self.skills)):
            if col in frame.columns:
                names.update(str(v).strip() for v in frame[col].dropna().unique())
        return sorted(n for n in names if n)

    def bench_movement_series(self) -> list[dict]:
        out = []
        for _, row in self.bench_movement.iterrows():
            week = _to_date(row.get("WeekStartDate"))
            if not week:
                continue
            out.append(
                {
                    "week_start": week,
                    "current_bench": _clean(row.get("CurrentBenchHeadcount")) or 0,
                    "emerging_bench": _clean(row.get("EmergingBenchHeadcount")) or 0,
                    "partial_capacity": _clean(row.get("PartialCapacityHeadcount")) or 0,
                    "available_fte": _clean(row.get("AvailableFTE")) or 0.0,
                    "notes": _clean(row.get("Notes")),
                }
            )
        out.sort(key=lambda r: r["week_start"])
        return out


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    """Return the process-wide, lazily-loaded DataStore singleton."""
    return DataStore()
