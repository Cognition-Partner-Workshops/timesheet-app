import { useEffect, useState } from "react";
import {
  getProposalDetail,
  submitBusinessReview,
  submitDeliveryReview,
  submitProposalToEWA,
} from "../api";
import type { Candidate, ProposalCandidateRecord, ProposalDetail, Role } from "../types";
import CandidateDrawer from "../components/CandidateDrawer";
import { Pill, ScoreBar, scoreColor } from "../ui";
import { Spinner } from "../ui";

const STATUS_KIND: Record<string, string> = {
  "Pending Delivery Review": "amber",
  "Pending Client Approval": "amber",
  "Ready for EWA": "green",
  "EWA Booked": "blue",
  "Changes Requested": "red",
  Cancelled: "red",
};

function reviewLabel(decision: string): string {
  if (decision === "APPROVED") return "Approved";
  if (decision === "CHANGES") return "Changes requested";
  if (decision === "CANCELLED") return "Cancelled";
  if (decision === "REJECTED") return "Rejected";
  return decision;
}

export default function ProposalReview({
  proposalId,
  role,
  onBack,
}: {
  proposalId: string;
  role: Role;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [view, setView] = useState<ProposalCandidateRecord | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getProposalDetail(proposalId).then(setDetail).catch(() => setError("Could not load proposal."));
  }
  useEffect(load, [proposalId]);

  if (!detail) return <Spinner />;

  const status = detail.proposal_status;
  const isDelivery = role === "delivery_manager";
  const isClient = role === "client_manager";
  const canDeliveryAct = isDelivery && status === "Pending Delivery Review";
  const canClientAct = isClient && status === "Pending Client Approval";
  const canSubmitEwa = (isClient || role === "workforce_planner") && status === "Ready for EWA";

  async function act(decision: string, type: "delivery" | "business") {
    if (decision !== "APPROVED" && !comment.trim()) {
      setError("A comment is required when not approving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (type === "delivery") await submitDeliveryReview(proposalId, decision, comment);
      else await submitBusinessReview(proposalId, decision, comment);
      setComment("");
      load();
    } catch (e) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(d || "Could not record the review.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEwa() {
    setBusy(true);
    setError(null);
    try {
      await submitProposalToEWA(proposalId);
      load();
    } catch (e) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(d || "Could not submit to EWA.");
    } finally {
      setBusy(false);
    }
  }

  const proj = detail.project;
  const delivery = detail.reviews.DELIVERY_MANAGER;
  const business = detail.reviews.CLIENT_MANAGER;

  return (
    <>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 12 }}>
        ← Back to queue
      </button>

      <div className="card">
        <div className="spread">
          <div>
            <h2 style={{ margin: 0 }}>{proj.title}</h2>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
              {proj.project_code} · {proj.domain || "—"} · {proj.region || "—"}
              {proj.city ? ` · ${proj.city}` : ""} · Planner: {detail.created_by || "—"}
            </div>
          </div>
          <Pill kind={STATUS_KIND[status] ?? "blue"}>{status}</Pill>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
          {proj.roles.map((r) => (
            <span className="pill" key={r.role_name}>
              {r.count}× {r.role_name}
            </span>
          ))}
          {proj.expected_start_date && <span className="pill blue">Start {proj.expected_start_date}</span>}
        </div>
        {detail.ai_summary && (
          <>
            <div className="section-title">AI summary</div>
            <div className="card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {detail.ai_summary}
            </div>
          </>
        )}
      </div>

      {/* Approval status + comments visible to all roles */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <GateCard title="Delivery fit" record={delivery} />
        <GateCard title="Business fit" record={business} />
      </div>

      <div className="section-title">Proposed team</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {detail.candidates.map((rec) => {
          const c: Candidate = rec.candidate;
          return (
            <div key={c.employee_id} className="card">
              <div className="spread">
                <strong>{c.name}</strong>
                <span className="score-chip" style={{ color: scoreColor(c.overall_score) }}>
                  {c.overall_score}
                </span>
              </div>
              <div className="faint" style={{ fontSize: 12, margin: "2px 0 8px" }}>
                {rec.role_name} · {c.grade} · {c.city}, {c.country}
              </div>
              <ScoreBar value={c.overall_score} />
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                {rec.ewa_status === "EWA Booked" && <Pill kind="blue">Booked</Pill>}
                {c.risks.length > 0 && (
                  <span className="faint" style={{ fontSize: 11.5 }}>⚠ {c.risks[0]}</span>
                )}
              </div>
              <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setView(rec)}>
                View full scorecard
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="banner mock" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {(canDeliveryAct || canClientAct) && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>
            {canDeliveryAct ? "Delivery review" : "Business review"}
          </h3>
          <label>Comment {canDeliveryAct ? "(required to request changes/reject)" : "(required to cancel/request changes)"}</label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your review comment…"
          />
          <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
            {canDeliveryAct && (
              <>
                <button className="btn primary" disabled={busy} onClick={() => act("APPROVED", "delivery")}>
                  Approve Delivery Fit
                </button>
                <button className="btn" disabled={busy} onClick={() => act("CHANGES", "delivery")}>
                  Request Changes
                </button>
                <button className="btn ghost" disabled={busy} onClick={() => act("REJECTED", "delivery")}>
                  Reject Proposal
                </button>
              </>
            )}
            {canClientAct && (
              <>
                <button className="btn primary" disabled={busy} onClick={() => act("APPROVED", "business")}>
                  Approve Business Fit
                </button>
                <button className="btn" disabled={busy} onClick={() => act("CHANGES", "business")}>
                  Request Changes
                </button>
                <button className="btn ghost" disabled={busy} onClick={() => act("CANCELLED", "business")}>
                  Cancel Proposal
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {canSubmitEwa && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="spread">
            <div>
              <strong>Both approvals complete — ready for EWA.</strong>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                Submitting books the team in EWA and removes them from future recommendations.
                No one is allocated automatically.
              </div>
            </div>
            <button className="btn primary" disabled={busy} onClick={submitEwa}>
              {busy ? "Submitting…" : "Submit to EWA"}
            </button>
          </div>
        </div>
      )}

      {view && (
        <CandidateDrawer
          candidate={view.candidate}
          roleName={view.role_name ?? undefined}
          optionLabel={view.option_label ?? undefined}
          proposedStart={view.proposed_start}
          opportunitySummary={proj.title}
          readOnly
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}

function GateCard({
  title,
  record,
}: {
  title: string;
  record?: { decision: string; comment: string | null; reviewed_at: string | null };
}) {
  const decided = record && record.decision && record.decision !== "PENDING";
  return (
    <div className="card">
      <div className="spread">
        <strong>{title}</strong>
        <Pill
          kind={
            !decided
              ? "amber"
              : record!.decision === "APPROVED"
                ? "green"
                : "red"
          }
        >
          {decided ? reviewLabel(record!.decision) : "Pending"}
        </Pill>
      </div>
      {record?.comment && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          “{record.comment}”
        </div>
      )}
    </div>
  );
}
