import { useEffect, useState } from "react";
import {
  createOpportunity,
  getOpportunityFormOptions,
  recommend,
} from "../api";
import type {
  Candidate,
  CreateOpportunityResult,
  Meta,
  OpportunityFormOptions,
  ParsedRole,
  RecommendationResult,
} from "../types";
import RecommendationResults from "./RecommendationResults";
import CandidateDrawer from "../components/CandidateDrawer";

interface RoleRow {
  role_name: string;
  count: number;
  grade_preference: string;
  required_skills: string;
  fte_required: number;
}

const EMPTY_ROLE: RoleRow = {
  role_name: "",
  count: 1,
  grade_preference: "",
  required_skills: "",
  fte_required: 1,
};

function splitSkills(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CreateOpportunityForm({ meta }: { meta: Meta | null }) {
  const [options, setOptions] = useState<OpportunityFormOptions | null>(null);
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationWeeks, setDurationWeeks] = useState<number | "">("");
  const [roles, setRoles] = useState<RoleRow[]>([{ ...EMPTY_ROLE }]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CreateOpportunityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selected, setSelected] = useState<{
    candidate: Candidate;
    role?: string;
    option?: string;
    start?: string | null;
  } | null>(null);

  useEffect(() => {
    getOpportunityFormOptions()
      .then(setOptions)
      .catch(() => setOptions(null));
  }, []);

  function updateRole(idx: number, patch: Partial<RoleRow>) {
    setRoles((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRole() {
    setRoles((rs) => [...rs, { ...EMPTY_ROLE }]);
  }

  function removeRole(idx: number) {
    setRoles((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));
  }

  const validRoles = roles.filter((r) => r.role_name.trim());
  const canSubmit = title.trim().length > 0 && validRoles.length > 0;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await createOpportunity({
        title: title.trim(),
        region: region || null,
        country: country || null,
        city: city || null,
        domain: domain || null,
        description: description || null,
        expected_start_date: startDate || null,
        duration_weeks: durationWeeks === "" ? null : Number(durationWeeks),
        roles: validRoles.map((r) => ({
          role_name: r.role_name,
          count: r.count,
          grade_preference: r.grade_preference || null,
          required_skills: splitSkills(r.required_skills),
          location_preference: city ? `${city}${country ? ", " + country : ""}` : country || null,
        })),
      });
      setSaved(res);
    } catch (e) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Could not save the opportunity. Is the database running?");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecommend() {
    if (!canSubmit) return;
    setScoring(true);
    try {
      const start = startDate || meta?.snapshot_date || new Date().toISOString().slice(0, 10);
      const mappedRoles: ParsedRole[] = validRoles.map((r) => ({
        role_name: r.role_name,
        count: r.count,
        required_skills: splitSkills(r.required_skills),
        desired_skills: [],
        domain: domain || null,
        location_preference:
          city ? `${city}${country ? ", " + country : ""}` : country || null,
        grade_preference: r.grade_preference || null,
        fte_required: r.fte_required,
        start_window_days: 0,
        start_date: start,
      }));
      const r = await recommend({
        summary: title || "the requested roles",
        start_date: start,
        roles: mappedRoles,
      });
      setResult(r);
    } finally {
      setScoring(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Create Opportunity</h1>
        <p>
          Capture a client opportunity with structured roles. Saving stores it in the
          workforce database; you can then generate staffing options.
        </p>
      </div>

      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label>Opportunity title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Banking core modernization"
            />
          </div>
          <div>
            <label>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">Select…</option>
              {options?.domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label>Region</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Select…</option>
              {options?.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Select…</option>
              {options?.countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>City / location</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pune" />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label>Expected start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>Duration (weeks)</label>
            <input
              type="number"
              min={0}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="e.g. 24"
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the opportunity, scope, and any constraints."
          />
        </div>

        <div className="divider" />

        <div className="spread">
          <h3>Roles required</h3>
          <button className="btn ghost sm" onClick={addRole}>
            + Add role
          </button>
        </div>

        <div className="grid" style={{ gap: 12, marginTop: 10 }}>
          {roles.map((role, idx) => (
            <div key={idx} className="card" style={{ background: "var(--navy-700)" }}>
              <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label>Role</label>
                  <select
                    value={role.role_name}
                    onChange={(e) => updateRole(idx, { role_name: e.target.value })}
                  >
                    <option value="">Select role…</option>
                    {options?.roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>People</label>
                  <input
                    type="number"
                    min={1}
                    value={role.count}
                    onChange={(e) => updateRole(idx, { count: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label>Grade</label>
                  <select
                    value={role.grade_preference}
                    onChange={(e) => updateRole(idx, { grade_preference: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options?.grades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>FTE each</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={1}
                    value={role.fte_required}
                    onChange={(e) => updateRole(idx, { fte_required: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 12, marginTop: 10 }}>
                <div>
                  <label>Required skills (comma-separated)</label>
                  <input
                    value={role.required_skills}
                    onChange={(e) => updateRole(idx, { required_skills: e.target.value })}
                    placeholder="e.g. Java, Microservices, Spring Boot"
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    className="btn ghost sm"
                    onClick={() => removeRole(idx)}
                    disabled={roles.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="banner mock" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}
        {saved && (
          <div className="banner" style={{ marginTop: 14 }}>
            ✓ {saved.message} Saved to the database ({saved.roles_created} role
            {saved.roles_created === 1 ? "" : "s"}). Opportunity code{" "}
            <strong>{saved.project_code}</strong>.
          </div>
        )}

        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn primary" onClick={handleSave} disabled={!canSubmit || saving}>
            {saving ? "Saving…" : "Save opportunity"}
          </button>
          <button className="btn" onClick={handleRecommend} disabled={!canSubmit || scoring}>
            {scoring ? "Scoring candidates…" : "Generate staffing options →"}
          </button>
        </div>
      </div>

      {result && (
        <RecommendationResults
          result={result}
          startDate={startDate || null}
          onSelect={(candidate, role, option) =>
            setSelected({ candidate, role, option, start: startDate || null })
          }
        />
      )}

      {selected && (
        <CandidateDrawer
          candidate={selected.candidate}
          roleName={selected.role}
          optionLabel={selected.option}
          proposedStart={selected.start}
          opportunitySummary={title}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
