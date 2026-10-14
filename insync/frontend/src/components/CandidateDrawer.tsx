// Slide-over drawer showing a full candidate scorecard with the deterministic
// match breakdown, evidence, risks, next actions, and a mock "Submit to EWA".
import { useState } from "react";
import type { Candidate } from "../types";
import { submitEWA } from "../api";
import { Pill, ScoreBar, availabilityClass, confidenceClass, scoreColor } from "../ui";

const COMPONENT_LABELS: Record<string, string> = {
  skill: "Skill match (35%)",
  availability: "Availability (25%)",
  domain: "Domain experience (15%)",
  location: "Location (10%)",
  grade: "Grade / seniority (10%)",
  project_history: "Project history (5%)",
};

interface Props {
  candidate: Candidate;
  roleName?: string;
  optionLabel?: string;
  proposedStart?: string | null;
  opportunitySummary?: string;
  readOnly?: boolean;
  onClose: () => void;
}

export default function CandidateDrawer({
  candidate,
  roleName,
  optionLabel,
  proposedStart,
  opportunitySummary,
  readOnly = false,
  onClose,
}: Props) {
  const c = candidate;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await submitEWA({
        employee_id: c.employee_id,
        employee_name: c.name,
        role_name: roleName,
        option_label: optionLabel,
        proposed_start_date: proposedStart ?? null,
        requested_fte: 1.0,
        match_score: c.overall_score,
        opportunity_summary: opportunitySummary,
      });
      setSubmitted(res.request.ewa_request_id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="drawer-overlay"
        role="button"
        tabIndex={0}
        aria-label="Close candidate details"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape" || e.key === " ") onClose();
        }}
      />
      <div className="drawer">
        <button className="drawer-close" onClick={onClose}>
          ×
        </button>

        <h2>{c.name}</h2>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Pill kind="blue">{c.role_archetype}</Pill>
          <Pill>{c.grade}</Pill>
          <Pill>
            {c.city}, {c.country}
          </Pill>
          <Pill kind={availabilityClass(c.availability_category)}>
            {c.availability_category}
          </Pill>
        </div>

        {roleName && (
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            Considered for <strong>{roleName}</strong>
            {optionLabel ? ` · ${optionLabel}` : ""}
          </div>
        )}

        <div
          className="card"
          style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 20 }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="score-chip"
              style={{ fontSize: 38, color: scoreColor(c.overall_score) }}
            >
              {c.overall_score}
            </div>
            <div className="faint" style={{ fontSize: 11 }}>
              / 100 match
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="spread">
              <span className="muted">Confidence</span>
              <Pill kind={confidenceClass(c.confidence)}>{c.confidence}</Pill>
            </div>
            <div className="spread" style={{ marginTop: 8 }}>
              <span className="muted">EWA status</span>
              <span>{c.ewa_status}</span>
            </div>
            <div className="spread" style={{ marginTop: 8 }}>
              <span className="muted">Earliest start</span>
              <span>{c.availability_detail.earliest_available_date ?? "—"}</span>
            </div>
          </div>
        </div>

        {c.explanation && (
          <>
            <div className="section-title">Why this recommendation</div>
            <div className="card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {c.explanation}
            </div>
          </>
        )}

        <div className="section-title">Match breakdown</div>
        <div className="card">
          {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div className="spread" style={{ fontSize: 13, marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ color: scoreColor(c.components[key]) }}>
                  {c.components[key]}
                </span>
              </div>
              <ScoreBar value={c.components[key]} />
            </div>
          ))}
        </div>

        <div className="section-title">Skills</div>
        <div className="card">
          <div style={{ fontSize: 12 }} className="muted">
            Matched required ({c.skill_detail.matched_required.length}/
            {c.skill_detail.required_total})
          </div>
          <div style={{ marginTop: 6 }}>
            {c.skill_detail.matched_required.map((s) => (
              <span className="tag match" key={s}>
                ✓ {s}
              </span>
            ))}
            {c.skill_detail.matched_required.length === 0 && (
              <span className="faint">None</span>
            )}
          </div>
          {c.skill_detail.missing_required.length > 0 && (
            <>
              <div style={{ fontSize: 12, marginTop: 12 }} className="muted">
                Missing required
              </div>
              <div style={{ marginTop: 6 }}>
                {c.skill_detail.missing_required.map((s) => (
                  <span className="tag miss" key={s}>
                    ✕ {s}
                  </span>
                ))}
              </div>
            </>
          )}
          {c.skill_detail.matched_desired.length > 0 && (
            <>
              <div style={{ fontSize: 12, marginTop: 12 }} className="muted">
                Matched desired
              </div>
              <div style={{ marginTop: 6 }}>
                {c.skill_detail.matched_desired.map((s) => (
                  <span className="tag desired" key={s}>
                    + {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="section-title">Evidence</div>
        <div className="card" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <strong>Domain:</strong> {c.domain_detail.evidence}
          </div>
          <div>
            <strong>Location:</strong> {c.location_detail.evidence}
          </div>
          <div>
            <strong>Seniority:</strong> {c.grade_detail.evidence}
          </div>
          <div>
            <strong>Project history:</strong> {c.project_history_detail.evidence}
          </div>
          <div>
            <strong>Availability:</strong> offers{" "}
            {c.availability_detail.available_fte_at_start} FTE at start
            {c.availability_detail.fte_gap > 0
              ? ` (gap ${c.availability_detail.fte_gap} FTE)`
              : ""}
            .
          </div>
        </div>

        <div className="section-title">Risks</div>
        <div className="card" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {c.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="section-title">Suggested next actions</div>
        <div className="card" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {c.next_actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>

        {!readOnly && (
        <div style={{ marginTop: 22 }}>
          {submitted ? (
            <div className="banner" style={{ marginBottom: 0 }}>
              ✓ Recommendation sent to EWA for approval — {submitted}
            </div>
          ) : (
            <button
              className="btn primary"
              style={{ width: "100%" }}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit to EWA Approval"}
            </button>
          )}
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8, textAlign: "center" }}>
            EWA remains the final approval step. This does not book the employee.
          </div>
        </div>
        )}
      </div>
    </>
  );
}
