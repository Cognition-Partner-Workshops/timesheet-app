import { useMemo, useState } from "react";
import { createProposal, recommend } from "../api";
import type {
  Candidate,
  PendingOpportunity,
  RecommendationResult,
  StaffingOption,
} from "../types";
import CandidateDrawer from "../components/CandidateDrawer";
import { Pill, ScoreBar, availabilityClass, confidenceClass, scoreColor } from "../ui";

interface SelectedItem {
  candidate: Candidate;
  role_name: string;
  option_label: string;
}

export default function PlannerWorkspace({
  opportunity,
  snapshotDate,
  onBack,
  onCreated,
}: {
  opportunity: PendingOpportunity;
  snapshotDate?: string;
  onBack: () => void;
  onCreated: (proposalId: string) => void;
}) {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [view, setView] = useState<SelectedItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = opportunity.expected_start_date || snapshotDate || new Date().toISOString().slice(0, 10);

  async function handleRecommend() {
    setScoring(true);
    setError(null);
    try {
      const roles = opportunity.roles.map((r) => ({
        role_name: r.role_name,
        count: r.count,
        required_skills: r.required_skills,
        desired_skills: [],
        domain: opportunity.domain,
        location_preference: opportunity.city
          ? `${opportunity.city}${opportunity.country ? ", " + opportunity.country : ""}`
          : opportunity.country,
        grade_preference: r.grade_preference,
        fte_required: 1,
        start_window_days: 0,
        start_date: startDate,
      }));
      const r = await recommend({ summary: opportunity.title, start_date: startDate, roles });
      setResult(r);
    } catch {
      setError("Could not generate recommendations.");
    } finally {
      setScoring(false);
    }
  }

  function toggle(candidate: Candidate, role_name: string, option_label: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[candidate.employee_id]) delete next[candidate.employee_id];
      else next[candidate.employee_id] = { candidate, role_name, option_label };
      return next;
    });
  }

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const option: StaffingOption | undefined = result?.options[activeOption];

  async function handleCreate() {
    if (selectedList.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createProposal({
        project_id: opportunity.project_id,
        option_label: option?.label ?? null,
        ai_summary: option?.explanation ?? null,
        candidates: selectedList.map((s) => ({
          candidate: s.candidate,
          role_name: s.role_name,
          option_label: s.option_label,
          proposed_start: startDate,
          proposed_fte: 1,
        })),
      });
      onCreated(res.proposal_id);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Could not create the staffing proposal.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 12 }}>
        ← Back to queue
      </button>

      <div className="card">
        <div className="spread">
          <div>
            <h2 style={{ margin: 0 }}>{opportunity.title}</h2>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
              {opportunity.project_code} · {opportunity.domain || "—"} · {opportunity.region || "—"}
              {opportunity.city ? ` · ${opportunity.city}` : ""}
            </div>
          </div>
          <Pill kind="amber">{opportunity.status}</Pill>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
          {opportunity.roles.map((r) => (
            <span className="pill" key={r.role_name}>
              {r.count}× {r.role_name}
            </span>
          ))}
          {opportunity.expected_start_date && (
            <span className="pill blue">Start {opportunity.expected_start_date}</span>
          )}
          {opportunity.created_by && <span className="pill">By {opportunity.created_by}</span>}
        </div>
        {opportunity.description && (
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            {opportunity.description}
          </p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={handleRecommend} disabled={scoring}>
            {scoring ? "Scoring candidates…" : "Generate Staffing Recommendations"}
          </button>
        </div>
      </div>

      {error && (
        <div className="banner mock" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <div className="row wrap" style={{ gap: 12, marginBottom: 16 }}>
            {result.options.map((o, i) => (
              <button
                key={o.key}
                className="card"
                onClick={() => setActiveOption(i)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: i === activeOption ? "var(--coral)" : "var(--line)",
                  boxShadow: i === activeOption ? "0 0 0 1px var(--coral)" : "none",
                }}
              >
                <div className="spread">
                  <strong>{o.label}</strong>
                  <span className="score-chip" style={{ color: scoreColor(o.team_score) }}>
                    {o.team_score}
                  </span>
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                  {o.description}
                </div>
              </button>
            ))}
          </div>

          {option?.explanation && (
            <div className="banner" style={{ marginBottom: 16 }}>
              {option.explanation}
            </div>
          )}

          <div className="grid" style={{ gap: 18 }}>
            {option?.assignments.map((a) => (
              <div className="card" key={a.role_name}>
                <div className="spread">
                  <h3 style={{ margin: 0 }}>{a.role_name}</h3>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Need {a.count_required} · {a.fte_required} FTE each
                  </span>
                </div>
                <div className="divider" />
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}
                >
                  {a.candidates.map((c) => {
                    const isSel = !!selected[c.employee_id];
                    return (
                      <div
                        key={c.employee_id}
                        className="card"
                        style={{
                          background: "var(--navy-700)",
                          borderColor: isSel ? "var(--coral)" : "var(--line)",
                          boxShadow: isSel ? "0 0 0 1px var(--coral)" : "none",
                        }}
                      >
                        <div className="spread">
                          <strong>{c.name}</strong>
                          <span className="score-chip" style={{ color: scoreColor(c.overall_score) }}>
                            {c.overall_score}
                          </span>
                        </div>
                        <div className="faint" style={{ fontSize: 12, margin: "2px 0 8px" }}>
                          {c.grade} · {c.city}, {c.country}
                        </div>
                        <ScoreBar value={c.overall_score} />
                        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                          <Pill kind={availabilityClass(c.availability_category)}>
                            {c.availability_category}
                          </Pill>
                          <Pill kind={confidenceClass(c.confidence)}>{c.confidence}</Pill>
                        </div>
                        <div className="row" style={{ gap: 8, marginTop: 12 }}>
                          <button
                            className={`btn sm ${isSel ? "primary" : ""}`}
                            onClick={() => toggle(c, a.role_name, option!.label)}
                          >
                            {isSel ? "✓ Selected" : "Select"}
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={() => setView({ candidate: c, role_name: a.role_name, option_label: option!.label })}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {a.candidates.length === 0 && (
                    <div className="faint" style={{ padding: 16 }}>
                      No suitable candidates for this role.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedList.length > 0 && (
        <div className="card" style={{ marginTop: 18, position: "sticky", bottom: 12 }}>
          <div className="spread">
            <strong>{selectedList.length} candidate(s) selected</strong>
            <button className="btn primary" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create Staffing Proposal →"}
            </button>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            {selectedList.map((s) => (
              <span className="tag match" key={s.candidate.employee_id}>
                {s.candidate.name} · {s.role_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {view && (
        <CandidateDrawer
          candidate={view.candidate}
          roleName={view.role_name}
          optionLabel={view.option_label}
          proposedStart={startDate}
          opportunitySummary={opportunity.title}
          readOnly
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}
