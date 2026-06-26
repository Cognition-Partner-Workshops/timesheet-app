import { useEffect, useState } from "react";
import { listEWA } from "../api";
import type { EWARequest } from "../types";
import { Pill, Spinner } from "../ui";

// Read-only log of the mock EWA submissions made during the session. The
// backend never books anyone — this is the "Recommendation sent to EWA" trail.
export default function EWAApprovals() {
  const [requests, setRequests] = useState<EWARequest[] | null>(null);

  useEffect(() => {
    listEWA().then((r) => setRequests(r.requests));
  }, []);

  if (!requests) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <h1>EWA Approval Queue</h1>
        <p>Mock approval workflow — recommendations submitted this session. No employee is actually booked.</p>
      </div>

      <div className="banner mock">
        Demo mode: submissions create a mock EWA request (MOCK-EWA-…) with status “Pending Approval”.
        EWA remains the human approval gate.
      </div>

      {requests.length === 0 ? (
        <div className="card faint" style={{ textAlign: "center", padding: 40 }}>
          No EWA requests yet. Generate staffing options and click “Submit to EWA Approval”.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Role</th>
                <th>Option</th>
                <th>Start</th>
                <th>FTE</th>
                <th>Score</th>
                <th>Status</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.ewa_request_id} style={{ cursor: "default" }}>
                  <td>
                    <strong>{r.ewa_request_id}</strong>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {new Date(r.submitted_at).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    {r.employee_name}
                    <div className="faint" style={{ fontSize: 11 }}>
                      {r.employee_id}
                    </div>
                  </td>
                  <td>{r.role_name ?? "—"}</td>
                  <td>{r.option_label ?? "—"}</td>
                  <td>{r.proposed_start_date ?? "—"}</td>
                  <td>{r.requested_fte}</td>
                  <td>{r.match_score ?? "—"}</td>
                  <td>
                    <Pill kind="amber">{r.status}</Pill>
                  </td>
                  <td>{r.booking_owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
