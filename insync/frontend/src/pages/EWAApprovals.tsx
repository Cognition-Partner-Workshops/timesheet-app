import { useEffect, useState } from "react";
import { listEWA, setBusinessFit, setDeliveryFit } from "../api";
import { useAuth } from "../auth";
import type { ApprovalGate, EWARequest } from "../types";
import { Pill, Spinner } from "../ui";

function gateKind(status: ApprovalGate["status"]): "green" | "amber" | "red" {
  if (status === "Approved") return "green";
  if (status === "Cancelled" || status === "Changes Requested") return "red";
  return "amber";
}

function GateRow({ label, gate }: { label: string; gate: ApprovalGate }) {
  return (
    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span className="faint" style={{ minWidth: 96 }}>
        {label}
      </span>
      <Pill kind={gateKind(gate.status)}>{gate.status}</Pill>
      {gate.by && (
        <span className="faint" style={{ fontSize: 12 }}>
          by {gate.by}
          {gate.note ? ` — “${gate.note}”` : ""}
        </span>
      )}
    </div>
  );
}

// EWA queue. The Delivery Manager signs off delivery fit; the Client Manager
// signs off business fit (or cancels). Workforce Planner sees status only.
export default function EWAApprovals() {
  const { user } = useAuth();
  const role = user?.role;
  const [requests, setRequests] = useState<EWARequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listEWA().then((r) => setRequests(r.requests));
  }, []);

  function replace(updated: EWARequest) {
    setRequests((prev) =>
      prev ? prev.map((r) => (r.ewa_request_id === updated.ewa_request_id ? updated : r)) : prev
    );
  }

  async function act(
    id: string,
    gate: "delivery" | "business",
    approve: boolean
  ) {
    const note = approve
      ? undefined
      : window.prompt(
          gate === "delivery" ? "What changes are needed?" : "Reason for cancelling?"
        ) || undefined;
    setBusy(id + gate);
    try {
      const fn = gate === "delivery" ? setDeliveryFit : setBusinessFit;
      const res = await fn(id, approve, note);
      replace(res.request);
    } finally {
      setBusy(null);
    }
  }

  if (!requests) return <Spinner />;

  const isDelivery = role === "delivery_manager";
  const isClient = role === "client_manager";

  return (
    <>
      <div className="page-head">
        <h1>EWA Approval Queue</h1>
        <p>
          Two-stage sign-off — Delivery Manager approves delivery fit, Client Partner
          approves business fit. No employee is actually booked (demo mode).
        </p>
      </div>

      <div className="banner mock">
        {isDelivery && "You can approve delivery fit or request changes on each proposal below."}
        {isClient && "You can approve business fit or cancel each proposal below."}
        {!isDelivery && !isClient &&
          "Status is read-only for your role. Delivery and Client managers act on the gates."}
      </div>

      {requests.length === 0 ? (
        <div className="card faint" style={{ textAlign: "center", padding: 40 }}>
          No EWA requests yet. Generate staffing options and click “Submit to EWA Approval”.
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {requests.map((r) => (
            <div key={r.ewa_request_id} className="card">
              <div className="spread">
                <div>
                  <strong>{r.ewa_request_id}</strong>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {new Date(r.submitted_at).toLocaleString()}
                    {r.submitted_by ? ` · raised by ${r.submitted_by}` : ""}
                  </div>
                </div>
                <Pill kind={r.status.startsWith("Approved") ? "green" : r.status === "Cancelled" ? "red" : "amber"}>
                  {r.status}
                </Pill>
              </div>

              <div className="divider" />

              <div className="row wrap" style={{ gap: 8 }}>
                <span className="pill">{r.employee_name ?? r.employee_id}</span>
                {r.role_name && <span className="pill">{r.role_name}</span>}
                {r.option_label && <span className="pill blue">{r.option_label}</span>}
                {r.proposed_start_date && <span className="pill">Start {r.proposed_start_date}</span>}
                <span className="pill">{r.requested_fte} FTE</span>
                {r.match_score != null && <span className="pill coral">Score {r.match_score}</span>}
              </div>
              {r.opportunity_summary && (
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  {r.opportunity_summary}
                </p>
              )}

              <div className="divider" />

              <GateRow label="Delivery fit" gate={r.delivery_fit} />
              {isDelivery && r.status !== "Cancelled" && r.delivery_fit.status !== "Approved" && (
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button
                    className="btn primary sm"
                    disabled={busy === r.ewa_request_id + "delivery"}
                    onClick={() => act(r.ewa_request_id, "delivery", true)}
                  >
                    Approve delivery fit
                  </button>
                  <button
                    className="btn ghost sm"
                    disabled={busy === r.ewa_request_id + "delivery"}
                    onClick={() => act(r.ewa_request_id, "delivery", false)}
                  >
                    Request changes
                  </button>
                </div>
              )}

              <div style={{ height: 8 }} />
              <GateRow label="Business fit" gate={r.business_fit} />
              {isClient && r.status !== "Cancelled" && r.business_fit.status !== "Approved" && (
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button
                    className="btn primary sm"
                    disabled={busy === r.ewa_request_id + "business"}
                    onClick={() => act(r.ewa_request_id, "business", true)}
                  >
                    Approve business fit
                  </button>
                  <button
                    className="btn ghost sm"
                    disabled={busy === r.ewa_request_id + "business"}
                    onClick={() => act(r.ewa_request_id, "business", false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
