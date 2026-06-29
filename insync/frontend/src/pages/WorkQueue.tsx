import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getPendingStaffing, getProposals } from "../api";
import type { Meta, PendingOpportunity, ProposalSummary } from "../types";
import { useAuth } from "../auth";
import { Pill, Spinner } from "../ui";
import PlannerWorkspace from "./PlannerWorkspace";
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

export default function WorkQueue({ meta }: { meta: Meta | null }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<PendingOpportunity[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const role = user!.role;
  const isPlanner = role === "workforce_planner";

  const openProposal = params.get("proposal");
  const openOpportunity = params.get("opportunity");

  const refresh = useCallback(() => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [
      getProposals().then((r) => setProposals(r.proposals)),
    ];
    if (isPlanner) {
      tasks.push(getPendingStaffing().then((r) => setOpportunities(r.opportunities)));
    }
    Promise.all(tasks).finally(() => setLoading(false));
  }, [isPlanner]);

  useEffect(refresh, [refresh]);

  function open(next: { proposal?: string; opportunity?: string }) {
    const p = new URLSearchParams();
    if (next.proposal) p.set("proposal", next.proposal);
    if (next.opportunity) p.set("opportunity", next.opportunity);
    setParams(p);
  }
  function back() {
    setParams(new URLSearchParams());
    refresh();
  }

  // ---- Detail views -------------------------------------------------- //
  if (openProposal) {
    return <ProposalReview proposalId={openProposal} role={role} onBack={back} />;
  }
  if (openOpportunity && isPlanner) {
    const opp = opportunities.find((o) => o.project_id === openOpportunity);
    if (opp) {
      return (
        <PlannerWorkspace
          opportunity={opp}
          snapshotDate={meta?.snapshot_date}
          onBack={back}
          onCreated={(pid) => open({ proposal: pid })}
        />
      );
    }
  }

  if (loading) return <Spinner />;

  const heading = isPlanner
    ? "Workforce Planner Queue"
    : role === "delivery_manager"
      ? "Delivery Reviews"
      : "Business Approvals";

  return (
    <>
      <div className="page-head">
        <h1>{heading}</h1>
        <p>Work assigned to your role across the staffing workflow.</p>
      </div>

      {isPlanner && (
        <>
          <h3>Pending Staffing Requests {opportunities.length > 0 && <span className="pill coral">{opportunities.length}</span>}</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 8 }}>
            {opportunities.map((o) => (
              <button key={o.project_id} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => open({ opportunity: o.project_id })}>
                <div className="spread">
                  <strong>{o.title}</strong>
                  <Pill kind="amber">{o.status}</Pill>
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                  {o.domain || "—"} · {o.region || "—"}{o.city ? ` · ${o.city}` : ""}
                </div>
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {o.roles.map((r) => (
                    <span className="pill" key={r.role_name}>{r.count}× {r.role_name}</span>
                  ))}
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                  {o.expected_start_date ? `Start ${o.expected_start_date} · ` : ""}Created by {o.created_by || "—"}
                </div>
              </button>
            ))}
            {opportunities.length === 0 && <div className="faint">No pending staffing requests.</div>}
          </div>
          <div className="divider" />
        </>
      )}

      <h3>{isPlanner ? "My Proposals" : "Proposals"}</h3>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 8 }}>
        {proposals.map((p) => (
          <button key={p.proposal_id} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => open({ proposal: p.proposal_id })}>
            <div className="spread">
              <strong>{p.project.title}</strong>
              <Pill kind={STATUS_KIND[p.proposal_status] ?? "blue"}>{p.proposal_status}</Pill>
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
              {p.project.project_code} · {p.candidate_count} candidate(s) · Planner {p.created_by || "—"}
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              {p.reviews.DELIVERY_MANAGER && p.reviews.DELIVERY_MANAGER.decision === "APPROVED" && (
                <Pill kind="green">Delivery ✓</Pill>
              )}
              {p.reviews.CLIENT_MANAGER && p.reviews.CLIENT_MANAGER.decision === "APPROVED" && (
                <Pill kind="green">Business ✓</Pill>
              )}
            </div>
          </button>
        ))}
        {proposals.length === 0 && <div className="faint">Nothing in your queue right now.</div>}
      </div>
    </>
  );
}
