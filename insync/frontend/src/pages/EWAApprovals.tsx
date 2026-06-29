import { useCallback, useEffect, useState } from "react";
import { getProposals } from "../api";
import { useAuth } from "../auth";
import type { ProposalSummary } from "../types";
import { Pill, Spinner } from "../ui";
import ProposalReview from "./ProposalReview";

const STATUS_KIND: Record<string, string> = {
  "Pending Staffing": "amber",
  "Pending Delivery Review": "amber",
  "Pending Client Approval": "amber",
  "Ready for EWA": "green",
  "EWA Booked": "blue",
  "Changes Requested": "red",
  Cancelled: "red",
};

// EWA Approval queue, backed by the real staffing-proposal workflow. Each role
// sees the proposals relevant to it (the backend scopes the list):
//   * Delivery Manager -> proposals awaiting delivery review.
//   * Client Manager   -> proposals awaiting business approval, ready for EWA,
//                         and already booked.
//   * Workforce Planner -> every proposal it raised, end-to-end.
// Opening a card shows the full review where the role-specific actions live.
export default function EWAApprovals() {
  const { user } = useAuth();
  const role = user!.role;
  const [proposals, setProposals] = useState<ProposalSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getProposals("ewa")
      .then((r) => setProposals(r.proposals))
      .catch(() => setProposals([]));
  }, []);

  useEffect(refresh, [refresh]);

  if (openId) {
    return (
      <ProposalReview
        proposalId={openId}
        role={role}
        onBack={() => {
          setOpenId(null);
          refresh();
        }}
      />
    );
  }

  if (!proposals) return <Spinner />;

  const hint =
    role === "delivery_manager"
      ? "Every submitted proposal across the workflow. Open one to review and approve delivery fit, request changes, or reject when it's awaiting you."
      : role === "client_manager"
        ? "Every submitted proposal across the workflow. Open one to approve business fit, request changes, or cancel when it's awaiting you."
        : "Every submitted proposal, end-to-end. Open one to track status and submit to EWA once both gates are approved.";

  return (
    <>
      <div className="page-head">
        <h1>EWA Approval Queue</h1>
        <p>{hint}</p>
      </div>

      {proposals.length === 0 ? (
        <div className="card faint" style={{ textAlign: "center", padding: 40 }}>
          No proposals in your EWA queue yet. Once a staffing proposal reaches your
          stage it appears here.
        </div>
      ) : (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}
        >
          {proposals.map((p) => (
            <button
              key={p.proposal_id}
              className="card"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => setOpenId(p.proposal_id)}
            >
              <div className="spread">
                <strong>{p.project.title}</strong>
                <Pill kind={STATUS_KIND[p.proposal_status] ?? "blue"}>
                  {p.proposal_status}
                </Pill>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                {p.project.project_code} · {p.candidate_count} candidate(s) · Planner{" "}
                {p.created_by || "—"}
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                <Pill
                  kind={
                    p.reviews.DELIVERY_MANAGER?.decision === "APPROVED" ? "green" : "amber"
                  }
                >
                  Delivery{" "}
                  {p.reviews.DELIVERY_MANAGER?.decision === "APPROVED" ? "✓" : "pending"}
                </Pill>
                <Pill
                  kind={
                    p.reviews.CLIENT_MANAGER?.decision === "APPROVED" ? "green" : "amber"
                  }
                >
                  Business{" "}
                  {p.reviews.CLIENT_MANAGER?.decision === "APPROVED" ? "✓" : "pending"}
                </Pill>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
