import { useEffect, useState } from "react";
import { getPerson, searchPeople, type PeopleFilters } from "../api";
import type { Candidate, Meta, PersonDetail, PersonSummary } from "../types";
import { Pill, Spinner, availabilityClass } from "../ui";
import CandidateDrawer from "../components/CandidateDrawer";

// Person detail is loaded and mapped into the shared CandidateDrawer shape so
// we reuse the same rich card everywhere.
export default function PeopleSearch({ meta }: { meta: Meta | null }) {
  const [filters, setFilters] = useState<PeopleFilters>({});
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);

  function run(f: PeopleFilters) {
    setLoading(true);
    searchPeople(f).then((r) => {
      setResults(r.results);
      setTotal(r.total);
      setLoading(false);
    });
  }

  useEffect(() => {
    run({});
  }, []);

  function update(key: keyof PeopleFilters, value: string | boolean) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    run(next);
  }

  async function openPerson(id: string) {
    const p = await getPerson(id);
    // Map the detailed person into a lightweight Candidate for the drawer.
    setSelected(toCandidate(p));
  }

  return (
    <>
      <div className="page-head">
        <h1>People Search</h1>
        <p>Find available talent by skill, role, grade, location, domain and availability.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div>
            <label>Search</label>
            <input
              placeholder="Name or ID"
              value={filters.q ?? ""}
              onChange={(e) => update("q", e.target.value)}
            />
          </div>
          <Select label="Skill" value={filters.skill} options={meta?.skills} onChange={(v) => update("skill", v)} />
          <Select label="Role" value={filters.role} options={meta?.roles} onChange={(v) => update("role", v)} />
          <Select label="Grade" value={filters.grade} options={meta?.grades} onChange={(v) => update("grade", v)} />
          <Select label="Region" value={filters.region} options={meta?.regions} onChange={(v) => update("region", v)} />
          <Select label="Country" value={filters.country} options={meta?.countries} onChange={(v) => update("country", v)} />
          <Select label="Domain" value={filters.domain} options={meta?.domains} onChange={(v) => update("domain", v)} />
          <Select
            label="Availability"
            value={filters.availability}
            options={meta?.availability_categories}
            onChange={(v) => update("availability", v)}
          />
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <label className="row" style={{ textTransform: "none", margin: 0, cursor: "pointer", width: "auto" }}>
            <input
              type="checkbox"
              style={{ width: 16, height: 16 }}
              checked={!!filters.bench_only}
              onChange={(e) => update("bench_only", e.target.checked)}
            />
            <span style={{ color: "var(--text)" }}>Bench only</span>
          </label>
          <button
            className="btn ghost sm"
            onClick={() => {
              setFilters({});
              run({});
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="muted">{total} people match</span>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Grade</th>
                <th>Location</th>
                <th>Domain</th>
                <th>Availability</th>
                <th>Top skills</th>
              </tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.employee_id} onClick={() => openPerson(p.employee_id)}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {p.employee_id}
                    </div>
                  </td>
                  <td>{p.role_archetype}</td>
                  <td>{p.grade}</td>
                  <td>
                    {p.city}, {p.country}
                  </td>
                  <td>{p.primary_domain}</td>
                  <td>
                    <Pill kind={availabilityClass(p.availability_category)}>
                      {p.availability_category}
                    </Pill>
                  </td>
                  <td>
                    {p.top_skills.slice(0, 4).map((s) => (
                      <span className="tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="faint" style={{ padding: 30, textAlign: "center" }}>
              No people match these filters.
            </div>
          )}
        </div>
      )}

      {selected && (
        <CandidateDrawer candidate={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {(options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Build a Candidate object from a PersonDetail so the drawer can render it
// outside the recommendation flow (no role-specific scoring here).
function toCandidate(p: PersonDetail): Candidate {
  const explanation =
    p.profile?.summary ||
    `${p.name} is a ${p.grade} ${p.role_archetype} based in ${p.country}.`;
  return {
    employee_id: p.employee_id,
    name: p.name,
    role_archetype: p.role_archetype,
    grade: p.grade,
    country: p.country,
    region: p.region,
    city: p.city,
    primary_domain: p.primary_domain,
    secondary_domain: p.secondary_domain,
    availability_category: p.availability_category,
    ewa_status: p.ewa_status,
    work_mode: p.work_mode,
    overall_score: 0,
    components: { skill: 0, availability: 0, domain: 0, location: 0, grade: 0, project_history: 0 },
    weighted_contributions: {},
    skill_detail: {
      score: 0,
      matched_required: p.skills.map((s) => s.name).slice(0, 12),
      missing_required: [],
      matched_desired: [],
      required_total: p.skills.length,
      desired_total: 0,
    },
    availability_detail: {
      score: 0,
      available_fte_at_start: p.available_fte_current,
      fte_gap: 0,
      earliest_available_date: p.expected_release_date,
      days_until_available: 0,
      days_late: 0,
      covers_start: true,
    },
    domain_detail: { score: 0, evidence: `Primary domain ${p.primary_domain}.` },
    location_detail: { score: 0, evidence: `${p.city}, ${p.country}.` },
    grade_detail: { score: 0, evidence: p.grade },
    project_history_detail: {
      score: 0,
      evidence: p.project_history[0]
        ? `${p.project_history[0].role} on ${p.project_history[0].project_name}.`
        : "No project history.",
    },
    confidence: "—",
    risks: p.profile?.mobility_notes ? [p.profile.mobility_notes] : ["Profile view — run an opportunity to score this person."],
    next_actions: ["Add to an opportunity to generate a scored recommendation."],
    explanation,
  };
}
