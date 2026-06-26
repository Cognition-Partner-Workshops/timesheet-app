import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { getMeta } from "./api";
import type { Meta } from "./types";
import Dashboard from "./pages/Dashboard";
import PeopleSearch from "./pages/PeopleSearch";
import OpportunityIntake from "./pages/OpportunityIntake";
import EWAApprovals from "./pages/EWAApprovals";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "▣" },
  { to: "/people", label: "People Search", icon: "◷" },
  { to: "/intake", label: "Opportunity Intake", icon: "✦" },
  { to: "/ewa", label: "EWA Approvals", icon: "✓" },
];

// MetaContext is passed down via props to keep the demo dependency-light.
export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">iS</div>
          <div>
            <div className="title">InSync</div>
            <div className="sub">Workforce Planning</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          Right People, Right Opportunity.
          <br />
          AI surfaces evidence — people decide.
          <br />
          <br />
          {meta && (
            <>
              Data snapshot: {meta.snapshot_date}
              <br />
              AI: {meta.ai_enabled ? `live (${meta.ai_provider})` : "mock mode"}
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/people" element={<PeopleSearch meta={meta} />} />
          <Route path="/intake" element={<OpportunityIntake meta={meta} />} />
          <Route path="/ewa" element={<EWAApprovals />} />
        </Routes>
      </main>
    </div>
  );
}
