"""Data access layer for the TalentBridge Workforce Planning Assistant.

Reads **only** from PostgreSQL (the ``insync_wfp`` database produced by the
loader). The Excel workbook is no longer used for any purpose; every record the
app serves -- employees, skills, profiles, project history, bench/availability,
opportunities and the supply forecast -- is sourced from Postgres and stitched
together using the documented join keys:

    * employee_code (``EMP-xxx``) - links employees, employee_skills,
      employee_evidence (PROFILE / PROJECT_HISTORY rows) and employee_capacity.
    * project_code / project_roles - opportunities and their required roles.

The loader preserves every original field inside ``raw_payload`` JSONB columns,
so the dict shapes returned here are identical to the previous Excel-backed
implementation and no downstream consumer needs to change. Employee names are
stored encrypted at rest; when ``FERNET_KEY`` is configured they are decrypted
for display, otherwise the masked token is shown.

The store is loaded once at process start and exposed as an in-memory object so
the API stays fast and deterministic. If PostgreSQL is unavailable the store
loads empty (it never falls back to Excel).
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime
from functools import lru_cache
from typing import Any, Optional

from . import config

logger = logging.getLogger(__name__)


# Availability categories used consistently across the dataset.
CAT_BENCH = "Current Bench"
CAT_PARTIAL = "Partial Capacity"
CAT_ROLL_30 = "Rolling Off 0-30"
CAT_ROLL_60 = "Rolling Off 31-60"
CAT_ROLL_90 = "Rolling Off 61-90"
CAT_ALLOCATED = "Allocated >90"


# Suggested chatbot prompts (previously the workbook's "Starter Prompts" sheet).
# These are static UI helper text and carry no employee data.
_STARTER_PROMPTS: list[dict] = [
    {
        "id": "PRM-001",
        "persona": "Sarah - Workforce Planner",
        "prompt": "Show current bench by discipline, grade, city and bench risk. Which people should be prioritised first?",
        "expected_output": "Bench summary, high-risk names/IDs, recommended next actions and EWA considerations.",
    },
    {
        "id": "PRM-002",
        "persona": "Jenny - Sales / Client Partner",
        "prompt": "For the highest-probability opportunities, create staffing options and explain which opportunities should be prioritised if the same candidate fits multiple roles.",
        "expected_output": "Opportunity ranking, candidate overlap, staffing trade-offs, confidence levels and recommended next actions.",
    },
    {
        "id": "PRM-003",
        "persona": "Raj - Delivery Manager",
        "prompt": "Who becomes available in the next 30 days with payments, Java, data, QA automation or design skills?",
        "expected_output": "Filtered near-bench list with release confidence and project history evidence.",
    },
    {
        "id": "PRM-004",
        "persona": "David - Regional Leader",
        "prompt": "What happens to available FTE over the next 12 weeks and where are bench pressure points emerging?",
        "expected_output": "Trend summary using the availability timeline and supply forecast, plus risk commentary.",
    },
    {
        "id": "PRM-005",
        "persona": "Sarah - Workforce Planner",
        "prompt": "Which available or soon-available people should not be matched to any current sample opportunity, and what should we do with them?",
        "expected_output": "No-fit candidates, evidence, reskilling/demand-generation suggestions and human review notes.",
    },
    {
        "id": "PRM-006",
        "persona": "Creative Services Lead",
        "prompt": "Which Creative Services people in Australia or India can support design-heavy opportunities in the next 30/60 days?",
        "expected_output": "Creative Services capacity, skills, release timing and suggested opportunity mapping.",
    },
    {
        "id": "PRM-007",
        "persona": "Sarah - Workforce Planner",
        "prompt": "For each high-priority opportunity, separate capability fit from availability feasibility. Which recommended candidates are blocked, and what is the best next action?",
        "expected_output": "Role-by-role capability score, availability score, FTE gap, constraint and EWA next action.",
    },
    {
        "id": "PRM-008",
        "persona": "Regional Delivery Leader",
        "prompt": "Build the strongest feasible portfolio staffing plan across all opportunities without double-booking people or double-counting the Partial Capacity view.",
        "expected_output": "Prioritised staffing portfolio, conflicts, alternatives, unfilled roles, trade-offs and EWA actions.",
    },
]


def _clean(value: Any) -> Any:
    """Normalise a value to JSON-safe form (None for blanks, trim strings)."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def _to_date(value: Any) -> Optional[date]:
    """Parse a value into a date, tolerating strings, datetimes and blanks."""
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(text[:len(fmt) + 4], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        return None


def _to_float(value: Any) -> Optional[float]:
    value = _clean(value)
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _split_list(value: Any) -> list[str]:
    """Split a semicolon/comma string (or pass through a list) into tokens."""
    value = _clean(value)
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    raw = str(value).replace(",", ";")
    return [token.strip() for token in raw.split(";") if token.strip()]


class DataStore:
    """In-memory representation of the workforce data, sourced from Postgres."""

    def __init__(self) -> None:
        self.snapshot_date: date = config.SNAPSHOT_DATE
        # Internal indexes (identical shapes to the previous implementation).
        self._employees: dict[str, dict] = {}
        self._skills_by_emp: dict[str, list[dict]] = {}
        self._profile_by_emp: dict[str, dict] = {}
        self._history_by_emp: dict[str, list[dict]] = {}
        self._bench_by_emp: dict[str, dict] = {}
        self._availability_by_emp: dict[str, list[dict]] = {}
        self._opportunities: list[dict] = []
        self._roles_by_opp: dict[str, list[dict]] = {}
        self._skill_vocab: list[str] = []
        self._bench_movement: list[dict] = []
        self._load()

    # ------------------------------------------------------------------ load
    def _connect(self):
        if not config.PG_ENABLED:
            logger.warning("PostgreSQL is disabled (TB_PG_ENABLED=false); store is empty.")
            return None
        try:
            import psycopg2
        except ImportError:  # pragma: no cover
            logger.error("psycopg2 not installed; cannot load DataStore from Postgres.")
            return None
        try:
            return psycopg2.connect(
                host=config.PG_HOST,
                port=config.PG_PORT,
                dbname=config.PG_DATABASE,
                user=config.PG_USER,
                password=config.PG_PASSWORD,
                connect_timeout=5,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Could not connect to PostgreSQL for DataStore: %s", exc)
            return None

    @staticmethod
    def _cipher():
        key = config.FERNET_KEY
        if not key or key.startswith("replace_with"):
            return None
        try:
            from cryptography.fernet import Fernet

            return Fernet(key.encode("utf-8"))
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("FERNET_KEY present but unusable; names stay masked: %s", exc)
            return None

    def _load(self) -> None:
        conn = self._connect()
        if conn is None:
            logger.error("DataStore loaded with no data (PostgreSQL unavailable).")
            return
        try:
            import psycopg2.extras

            cipher = self._cipher()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                self._load_skills(cur)
                self._load_evidence(cur)
                self._load_capacity(cur)
                self._load_employees(cur, cipher)
                self._load_opportunities(cur)
                self._build_skill_vocab(cur)
                self._build_bench_movement()
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Failed to load DataStore from PostgreSQL: %s", exc)
        finally:
            conn.close()

    # ------------------------------------------------------------- sub-loaders
    def _load_skills(self, cur) -> None:
        cur.execute(
            "SELECT e.employee_code, s.skill_name, s.skill_category, s.skill_level, "
            "s.years_experience, s.last_used_date, s.evidence_source, s.confidence "
            "FROM employee_skills s JOIN employees e USING (employee_id) "
            "ORDER BY e.employee_code, s.skill_name;"
        )
        for row in cur.fetchall():
            emp = _clean(row["employee_code"])
            if not emp:
                continue
            self._skills_by_emp.setdefault(emp, []).append(
                {
                    "name": _clean(row["skill_name"]),
                    "category": _clean(row["skill_category"]),
                    "level": _clean(row["skill_level"]),
                    "years": _to_float(row["years_experience"]),
                    "last_used": _to_date(row["last_used_date"]),
                    "evidence": _clean(row["evidence_source"]),
                    "confidence": _clean(row["confidence"]),
                }
            )

    def _load_evidence(self, cur) -> None:
        cur.execute(
            "SELECT e.employee_code, ev.evidence_type, ev.raw_payload "
            "FROM employee_evidence ev JOIN employees e USING (employee_id) "
            "WHERE ev.evidence_type IN ('PROFILE', 'PROJECT_HISTORY') "
            "ORDER BY e.employee_code, ev.created_at;"
        )
        for row in cur.fetchall():
            emp = _clean(row["employee_code"])
            payload = row["raw_payload"] or {}
            if not emp or not isinstance(payload, dict):
                continue
            if row["evidence_type"] == "PROFILE":
                self._profile_by_emp[emp] = {
                    "summary": _clean(payload.get("ProfileSummary")),
                    "key_strengths": _split_list(payload.get("KeyStrengths")),
                    "preferred_work_types": _clean(payload.get("PreferredWorkTypes")),
                    "domain_experience": _clean(payload.get("DomainExperienceSummary")),
                    "certifications": _split_list(payload.get("Certifications")),
                    "recent_highlights": _clean(payload.get("RecentHighlights")),
                    "mobility_notes": _clean(payload.get("MobilityNotes")),
                    "languages": _split_list(payload.get("Languages")),
                }
            else:  # PROJECT_HISTORY
                self._history_by_emp.setdefault(emp, []).append(
                    {
                        "client_name": _clean(payload.get("Client_Name")),
                        "client_type": _clean(payload.get("Client_Type")),
                        "project_name": _clean(payload.get("Project_Name")),
                        "domain": _clean(payload.get("Domain")),
                        "role": _clean(payload.get("Role")),
                        "start_date": _to_date(payload.get("StartDate")),
                        "end_date": _to_date(payload.get("EndDate")),
                        "technologies": _split_list(payload.get("KeyTechnologiesOrMethods")),
                        "responsibilities": _clean(payload.get("Responsibilities")),
                        "outcome": _clean(payload.get("OutcomeEvidence")),
                        "region": _clean(payload.get("Region")),
                        "team_size": _clean(payload.get("TeamSize")),
                    }
                )

    def _load_capacity(self, cur) -> None:
        """Load bench records and the weekly availability timeline per employee."""
        cur.execute(
            "SELECT e.employee_code, c.availability_timeline, c.raw_payload "
            "FROM employee_capacity c JOIN employees e USING (employee_id);"
        )
        for row in cur.fetchall():
            emp = _clean(row["employee_code"])
            if not emp:
                continue
            payload = row["raw_payload"] or {}
            bench = (payload.get("bench") if isinstance(payload, dict) else None) or None
            if isinstance(bench, dict):
                self._bench_by_emp[emp] = {
                    "bench_type": _clean(bench.get("BenchType")),
                    "available_from": _to_date(bench.get("AvailableFrom")),
                    "bench_fte": _clean(bench.get("BenchFTE")),
                    "bench_risk": _clean(bench.get("BenchRisk")),
                    "time_on_bench_days": _clean(bench.get("TimeOnBenchDays")),
                    "suggested_action": _clean(bench.get("SuggestedAction")),
                    "target_role_fit": _clean(bench.get("TargetRoleFit")),
                    "ewa_action_required": _clean(bench.get("EWAActionRequired")),
                    "top_skills": _split_list(bench.get("TopSkills")),
                }

            timeline = row["availability_timeline"] or []
            weeks: list[dict] = []
            for cell in timeline:
                if not isinstance(cell, dict):
                    continue
                weeks.append(
                    {
                        "week_start": _to_date(cell.get("week_start_date")),
                        "available_fte": _to_float(cell.get("available_fte")) or 0.0,
                        "type": _clean(cell.get("availability_type")),
                        "confidence": _clean(cell.get("confidence")),
                    }
                )
            weeks.sort(key=lambda r: r["week_start"] or date.max)
            self._availability_by_emp[emp] = weeks

    def _load_employees(self, cur, cipher) -> None:
        cur.execute(
            "SELECT employee_code, employee_token, employee_status, "
            "employee_name_encrypted, raw_payload "
            "FROM employees ORDER BY employee_code;"
        )
        for row in cur.fetchall():
            emp = _clean(row["employee_code"])
            payload = row["raw_payload"] or {}
            if not emp or not isinstance(payload, dict):
                continue
            name = self._decrypt_name(cipher, row["employee_name_encrypted"]) or _clean(
                payload.get("Employee_Name")
            )
            built = self._build_employee(emp, name, payload)
            built["employee_token"] = _clean(row["employee_token"])
            built["status"] = _clean(row["employee_status"]) or _clean(
                payload.get("EmployeeStatus")
            )
            self._employees[emp] = built

    @staticmethod
    def _decrypt_name(cipher, token: Any) -> Optional[str]:
        token = _clean(token)
        if not cipher or not token:
            return None
        try:
            return cipher.decrypt(str(token).encode("utf-8")).decode("utf-8")
        except Exception:  # pragma: no cover - bad token / wrong key
            return None

    def _build_employee(self, emp_id: str, name: Optional[str], p: dict) -> dict:
        return {
            "employee_id": emp_id,
            "name": name,
            "region": _clean(p.get("Region")),
            "country": _clean(p.get("Country")),
            "city": _clean(p.get("City")),
            "timezone": _clean(p.get("Timezone")),
            "department": _clean(p.get("Department")),
            "discipline": _clean(p.get("Discipline")),
            "role_archetype": _clean(p.get("RoleArchetype")),
            "grade": _clean(p.get("Grade")),
            "career_level": _clean(p.get("CareerLevel")),
            "primary_domain": _clean(p.get("PrimaryDomain")),
            "secondary_domain": _clean(p.get("SecondaryDomain")),
            "availability_category": _clean(p.get("AvailabilityCategory")),
            "current_allocation_fte": _to_float(p.get("CurrentAllocationFTE")) or 0.0,
            "available_fte_current": _to_float(p.get("AvailableFTECurrent")) or 0.0,
            "expected_release_date": _to_date(p.get("ExpectedReleaseDate")),
            "release_window": _clean(p.get("ReleaseWindow")),
            "ewa_status": _clean(p.get("EWAStatus")),
            "current_account_id": _clean(p.get("CurrentAccountID")),
            "current_project_id": _clean(p.get("CurrentProjectID")),
            "current_role": _clean(p.get("CurrentRole")),
            "work_mode": _clean(p.get("WorkMode")),
            "skills": self._skills_by_emp.get(emp_id, []),
            "profile": self._profile_by_emp.get(emp_id),
            "project_history": self._history_by_emp.get(emp_id, []),
            "bench": self._bench_by_emp.get(emp_id),
        }

    def _load_opportunities(self, cur) -> None:
        cur.execute(
            "SELECT project_id, project_code, project_name, client_name, client_type, "
            "region, country, city, domain, stage, probability, expected_start_date, "
            "duration_weeks, commercial_priority, delivery_risk, timezone_preference, "
            "raw_payload FROM projects ORDER BY project_code;"
        )
        projects = cur.fetchall()

        # Roles grouped by project_id.
        cur.execute(
            "SELECT project_id, role_id, role_code, role_name, discipline, "
            "grade_preference, required_skills, desired_skills, "
            "domain_experience_required, location_preference, start_date, "
            "duration_weeks, required_fte, minimum_individual_fte, "
            "can_combine_candidates, priority, flexibility_notes "
            "FROM project_roles ORDER BY project_id, role_code;"
        )
        roles_by_pid: dict[str, list[dict]] = {}
        for r in cur.fetchall():
            pid = str(r["project_id"])
            roles_by_pid.setdefault(pid, []).append(r)

        for proj in projects:
            opp_id = _clean(proj["project_code"])
            if not opp_id:
                continue
            payload = proj["raw_payload"] if isinstance(proj["raw_payload"], dict) else {}
            roles = [
                self._role_record(opp_id, r)
                for r in roles_by_pid.get(str(proj["project_id"]), [])
            ]
            self._roles_by_opp[opp_id] = roles
            self._opportunities.append(
                {
                    "opportunity_id": opp_id,
                    "name": _clean(proj["project_name"]),
                    "client_name": _clean(proj["client_name"]),
                    "client_type": _clean(proj["client_type"]),
                    "region": _clean(proj["region"]),
                    "country": _clean(proj["country"]),
                    "city": _clean(proj["city"]),
                    "domain": _clean(proj["domain"]),
                    "stage": _clean(proj["stage"]),
                    "probability": _to_float(proj["probability"]),
                    "expected_start_date": _to_date(proj["expected_start_date"]),
                    "duration_weeks": _clean(proj["duration_weeks"]),
                    "commercial_priority": _clean(proj["commercial_priority"]),
                    "delivery_risk": _clean(proj["delivery_risk"]),
                    "brief": _clean(payload.get("description"))
                    or _clean(payload.get("OpportunityBrief")),
                    "timezone_preference": _clean(proj["timezone_preference"]),
                    "roles": roles,
                }
            )

    @staticmethod
    def _role_record(opp_id: str, r: dict) -> dict:
        return {
            "opportunity_role_id": _clean(r["role_code"]),
            "opportunity_id": opp_id,
            "role_name": _clean(r["role_name"]),
            "discipline": _clean(r["discipline"]),
            "grade_preference": _clean(r["grade_preference"]),
            "required_skills": _split_list(r["required_skills"]),
            "desired_skills": _split_list(r["desired_skills"]),
            "domain": _clean(r["domain_experience_required"]),
            "location_preference": _clean(r["location_preference"]),
            "start_date": _to_date(r["start_date"]),
            "duration_weeks": _clean(r["duration_weeks"]),
            "fte_required": _to_float(r["required_fte"]) or 1.0,
            "priority": _clean(r["priority"]),
            "flexibility_notes": _clean(r["flexibility_notes"]),
            "minimum_individual_fte": _to_float(r["minimum_individual_fte"]),
            "can_combine_candidates": _clean(r["can_combine_candidates"]),
        }

    def _build_skill_vocab(self, cur) -> None:
        cur.execute("SELECT DISTINCT skill_name FROM employee_skills;")
        names = {
            str(row["skill_name"]).strip()
            for row in cur.fetchall()
            if _clean(row["skill_name"])
        }
        self._skill_vocab = sorted(n for n in names if n)

    def _build_bench_movement(self) -> None:
        """Derive the 12-week supply forecast from per-employee timelines."""
        current: dict[date, int] = {}
        emerging: dict[date, int] = {}
        partial: dict[date, int] = {}
        avail_fte: dict[date, float] = {}
        for weeks in self._availability_by_emp.values():
            for cell in weeks:
                week = cell["week_start"]
                if week is None:
                    continue
                kind = (cell["type"] or "").strip()
                avail_fte[week] = avail_fte.get(week, 0.0) + float(cell["available_fte"] or 0.0)
                if kind == "Current Bench":
                    current[week] = current.get(week, 0) + 1
                elif kind == "Expected Roll-off":
                    emerging[week] = emerging.get(week, 0) + 1
                elif kind in ("Partial Capacity", "Full Availability After Partial"):
                    partial[week] = partial.get(week, 0) + 1

        series = []
        for week in sorted(avail_fte):
            series.append(
                {
                    "week_start": week,
                    "current_bench": current.get(week, 0),
                    "emerging_bench": emerging.get(week, 0),
                    "partial_capacity": partial.get(week, 0),
                    "available_fte": round(avail_fte.get(week, 0.0), 1),
                    "notes": None,
                }
            )
        self._bench_movement = series

    # -------------------------------------------------------------- accessors
    def all_employees(self) -> list[dict]:
        return list(self._employees.values())

    def get_employee(self, emp_id: str) -> Optional[dict]:
        return self._employees.get(emp_id)

    def availability_calendar(self, emp_id: str) -> list[dict]:
        return self._availability_by_emp.get(emp_id, [])

    def all_opportunities(self) -> list[dict]:
        return list(self._opportunities)

    def roles_for_opportunity(self, opp_id: str) -> list[dict]:
        return self._roles_by_opp.get(opp_id, [])

    def starter_prompt_list(self) -> list[dict]:
        return list(_STARTER_PROMPTS)

    # --------------------------------------------------- catalog / vocabulary
    def skill_vocabulary(self) -> list[str]:
        return list(self._skill_vocab)

    def bench_movement_series(self) -> list[dict]:
        return list(self._bench_movement)


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    """Return the process-wide, lazily-loaded DataStore singleton."""
    return DataStore()
