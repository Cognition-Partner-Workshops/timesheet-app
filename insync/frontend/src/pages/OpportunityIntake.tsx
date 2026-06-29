import { useEffect, useState } from "react";
import { parseRequirement, recommend } from "../api";
import type { Candidate, Meta, ParsedRequirement, RecommendationResult } from "../types";
import RecommendationResults from "./RecommendationResults";
import CandidateDrawer from "../components/CandidateDrawer";
import { CHAT_BRIEF_KEY } from "../components/Chatbot";
import { useAuth } from "../auth";
import CreateOpportunityForm from "./CreateOpportunityForm";

const EXAMPLES = [
  "Need 2 Java developers, 1 QA engineer and 1 PM for a banking project in Pune starting in 30 days.",
  "Looking for a senior data engineer and an AI engineer for a healthcare data platform in Bengaluru in 60 days.",
  "Need a solution architect and 2 React frontend engineers for a payments programme in Singapore ASAP.",
  "1 UX designer and 1 business analyst for a retail discovery in Dubai next month.",
];

export default function OpportunityIntake({ meta }: { meta: Meta | null }) {
  const { user } = useAuth();
  const isClient = user?.role === "client_manager";
  const [text, setText] = useState(EXAMPLES[0]);
  const [parsed, setParsed] = useState<ParsedRequirement | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [selected, setSelected] = useState<{
    candidate: Candidate;
    role?: string;
    option?: string;
    start?: string | null;
  } | null>(null);

  // If the chatbot routed a natural-language brief here, pre-fill the box.
  useEffect(() => {
    const brief = sessionStorage.getItem(CHAT_BRIEF_KEY);
    if (brief) {
      setText(brief);
      sessionStorage.removeItem(CHAT_BRIEF_KEY);
    }
  }, []);

  async function handleParse() {
    setParsing(true);
    setResult(null);
    try {
      const p = await parseRequirement(text);
      setParsed(p);
    } finally {
      setParsing(false);
    }
  }

  async function handleRecommend() {
    if (!parsed) return;
    setScoring(true);
    try {
      const r = await recommend({
        summary: parsed.summary,
        start_date: parsed.start_date,
        roles: parsed.roles,
      });
      setResult(r);
    } finally {
      setScoring(false);
    }
  }

  function updateRole(idx: number, patch: Partial<ParsedRequirement["roles"][number]>) {
    if (!parsed) return;
    const roles = parsed.roles.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setParsed({ ...parsed, roles });
  }

  // Client Partners get the structured, database-backed Create Opportunity form.
  if (isClient) {
    return <CreateOpportunityForm />;
  }

  return (
    <>
      <div className="page-head">
        <h1>Opportunity Intake</h1>
        <p>Describe an opportunity in plain English — TalentBridge structures it, then scores your people.</p>
      </div>

      {meta && (
        <div className={`banner ${meta.ai_enabled ? "" : "mock"}`}>
          {meta.ai_enabled
            ? `AI parsing live via ${meta.ai_provider}. The scoring engine still makes every selection.`
            : "Running in mock-AI mode (no API key) — deterministic parser + explanations. Set an API key to enable live AI."}
        </div>
      )}

      <div className="card">
        <label>Opportunity requirement</label>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Need 2 Java developers, 1 QA engineer and 1 PM for a banking project in Pune starting in 30 days."
        />
        <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="btn ghost sm" onClick={() => setText(ex)}>
              Example {i + 1}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={handleParse} disabled={parsing || !text.trim()}>
            {parsing ? "Parsing…" : "Parse requirement"}
          </button>
        </div>
      </div>

      {parsed && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="spread">
            <h3>Structured requirement</h3>
            <span className="pill blue">parser: {parsed.parser}</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
            {parsed.summary}
          </p>
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            {parsed.domain && <span className="pill">Domain: {parsed.domain}</span>}
            {parsed.location && <span className="pill">Location: {parsed.location}</span>}
            {parsed.grade_preference && <span className="pill">Grade: {parsed.grade_preference}</span>}
            <span className="pill">Start in ~{parsed.start_window_days}d ({parsed.start_date})</span>
            <span className="pill coral">Total {parsed.required_fte} FTE</span>
          </div>

          <div className="divider" />

          <div className="grid" style={{ gap: 12 }}>
            {parsed.roles.map((role, idx) => (
              <div key={idx} className="card" style={{ background: "var(--navy-700)" }}>
                <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Role</label>
                    <input value={role.role_name} onChange={(e) => updateRole(idx, { role_name: e.target.value })} />
                  </div>
                  <div>
                    <label>Count</label>
                    <input
                      type="number"
                      min={1}
                      value={role.count}
                      onChange={(e) => updateRole(idx, { count: parseInt(e.target.value) || 1 })}
                    />
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
                <div style={{ marginTop: 8 }}>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Required:{" "}
                  </span>
                  {role.required_skills.map((s) => (
                    <span className="tag match" key={s}>
                      {s}
                    </span>
                  ))}
                  {role.desired_skills.map((s) => (
                    <span className="tag desired" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={handleRecommend} disabled={scoring}>
              {scoring ? "Scoring candidates…" : "Generate staffing options →"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <RecommendationResults
          result={result}
          startDate={parsed?.start_date ?? null}
          onSelect={(candidate, role, option) =>
            setSelected({ candidate, role, option, start: parsed?.start_date })
          }
        />
      )}

      {selected && (
        <CandidateDrawer
          candidate={selected.candidate}
          roleName={selected.role}
          optionLabel={selected.option}
          proposedStart={selected.start}
          opportunitySummary={parsed?.summary}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
