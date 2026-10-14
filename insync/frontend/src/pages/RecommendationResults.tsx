import { useState } from "react";
import type { Candidate, RecommendationResult, StaffingOption } from "../types";
import { Pill, ScoreBar, availabilityClass, confidenceClass, scoreColor } from "../ui";

// Renders the three staffing options as tabs, each with per-role candidate
// shortlists. Clicking a candidate opens the shared drawer via onSelect.
export default function RecommendationResults({
  result,
  startDate,
  onSelect,
}: {
  result: RecommendationResult;
  startDate: string | null;
  onSelect: (candidate: Candidate, role: string, option: string) => void;
}) {
  const [active, setActive] = useState(0);
  const option = result.options[active];

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Staffing Options</h2>
      <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 16px" }}>
        Three strategies built by the deterministic engine. AI explains each pick — it never selects.
      </p>

      <div className="row wrap" style={{ gap: 12, marginBottom: 18 }}>
        {result.options.map((o, i) => (
          <button
            key={o.key}
            className={`card`}
            onClick={() => setActive(i)}
            style={{
              flex: 1,
              minWidth: 220,
              textAlign: "left",
              cursor: "pointer",
              borderColor: i === active ? "var(--coral)" : "var(--line)",
              boxShadow: i === active ? "0 0 0 1px var(--coral)" : "none",
            }}
          >
            <div className="spread">
              <strong>{o.label}</strong>
              <span className="score-chip" style={{ color: scoreColor(o.team_score) }}>
                {o.team_score}
              </span>
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 6, minHeight: 32 }}>
              {o.description}
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <Pill kind={confidenceClass(o.team_confidence)}>{o.team_confidence} confidence</Pill>
              {o.earliest_team_start && <Pill>start {o.earliest_team_start}</Pill>}
            </div>
          </button>
        ))}
      </div>

      {option && <OptionPanel option={option} startDate={startDate} onSelect={onSelect} />}
    </div>
  );
}

function OptionPanel({
  option,
  onSelect,
}: {
  option: StaffingOption;
  startDate: string | null;
  onSelect: (candidate: Candidate, role: string, option: string) => void;
}) {
  return (
    <div>
      {option.explanation && (
        <div className="banner" style={{ marginBottom: 18 }}>
          {option.explanation}
        </div>
      )}
      <div className="grid" style={{ gap: 18 }}>
        {option.assignments.map((a) => (
          <div className="card" key={a.role_name}>
            <div className="spread">
              <div>
                <h3>{a.role_name}</h3>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                  Need {a.count_required} · {a.fte_required} FTE each
                  {a.unfilled > 0 && (
                    <span className="pill red" style={{ marginLeft: 8 }}>
                      {a.unfilled} unfilled
                    </span>
                  )}
                </div>
                {a.unfilled > 0 && a.candidates.length > 0 && a.unfilled_reason && (
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                    {a.unfilled_reason}
                  </div>
                )}
              </div>
              <div style={{ maxWidth: "50%", textAlign: "right" }}>
                {a.required_skills.map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {a.location_fallback && a.location_fallback_notice && (
              <div
                className="pill amber"
                style={{ display: "block", padding: "8px 12px", marginTop: 8, fontSize: 12.5 }}
              >
                ⤢ {a.location_fallback_notice}
                {typeof a.location_penalty === "number" && a.location_penalty > 0 && (
                  <> (location penalty +{a.location_penalty} applied to risk)</>
                )}
              </div>
            )}

            <div className="divider" />

            {a.capability_gap ? (
              <div className="card" style={{ background: "var(--navy-700)", padding: 16 }}>
                <div className="spread">
                  <strong>{a.capability_gap.headline}</strong>
                  <span className="score-chip" style={{ color: scoreColor(0) }}>
                    0
                  </span>
                </div>
                <div className="row wrap" style={{ gap: 6, margin: "8px 0 4px" }}>
                  <Pill kind="amber">Match Score 0</Pill>
                  <Pill kind="red">Risk · Capability Gap</Pill>
                </div>
                <div className="faint" style={{ fontSize: 12.5, margin: "6px 0 10px" }}>
                  {a.capability_gap.summary}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                  Suggested next actions
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                  {a.capability_gap.suggested_next_actions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {a.candidates.map((c) => (
                <div
                  key={c.employee_id}
                  className="card"
                  role="button"
                  tabIndex={0}
                  style={{ background: "var(--navy-700)", cursor: "pointer" }}
                  onClick={() => onSelect(c, a.role_name, option.label)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(c, a.role_name, option.label);
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
                    {typeof c.risk_score === "number" && (
                      <Pill
                        kind={
                          c.risk_level === "High"
                            ? "red"
                            : c.risk_level === "Medium"
                            ? "amber"
                            : "green"
                        }
                      >
                        Risk {c.risk_score}
                      </Pill>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {c.skill_detail.matched_required.slice(0, 4).map((s) => (
                      <span className="tag match" key={s}>
                        ✓ {s}
                      </span>
                    ))}
                    {c.skill_detail.missing_required.slice(0, 3).map((s) => (
                      <span className="tag miss" key={s}>
                        ✕ {s}
                      </span>
                    ))}
                  </div>
                  {c.risks.length > 0 && (
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                      ⚠ {c.risks[0]}
                    </div>
                  )}
                </div>
              ))}
              {a.candidates.length === 0 && (
                <div className="faint" style={{ padding: 16 }}>
                  {a.unfilled_reason ||
                    "Unfortunately, there aren't any available people for this role."}
                </div>
              )}
            </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
