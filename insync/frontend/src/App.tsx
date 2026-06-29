import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getMeta } from "./api";
import type { Meta } from "./types";
import { ROLE_NAV, useAuth } from "./auth";
import { useTheme } from "./theme";
import Dashboard from "./pages/Dashboard";
import PeopleSearch from "./pages/PeopleSearch";
import OpportunityIntake from "./pages/OpportunityIntake";
import EWAApprovals from "./pages/EWAApprovals";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AccessRestricted from "./pages/AccessRestricted";
import Chatbot from "./components/Chatbot";
import { BrandMark } from "./components/BrandMark";
import { Spinner } from "./ui";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const initials = user.full_name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="user-menu">
      <button className="user-button" onClick={() => setOpen((o) => !o)}>
        <span className="user-avatar">{initials}</span>
        <span className="user-meta">
          <span className="user-name">{user.full_name}</span>
          <span className="pill blue user-role">{user.role_label}</span>
        </span>
      </button>
      {open && (
        <div className="user-dropdown card">
          <div className="muted">{user.email}</div>
          <div className="divider" />
          <button
            className="btn ghost sm"
            onClick={() => {
              logout();
              navigate("/signin", { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { user } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  if (!user) return null;
  const nav = ROLE_NAV[user.role];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandMark />
        {nav.map((n) => (
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
          Right People. Right Opportunity.
          <br />
          AI surfaces evidence — people decide.
          <br />
          <br />
          {meta && (
            <>
              Data snapshot: {meta.snapshot_date}
              <br />
              AI: {meta.ai_enabled ? `live (${meta.ai_provider})` : "mock mode"}
              <br />
              Retrieval: {meta.retrieval_enabled ? "pgvector" : "fallback"}
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <ThemeToggle />
          <UserMenu />
        </div>
        <Routes>
          <Route path="/" element={<Navigate to={user.landing} replace />} />
          <Route
            path="/dashboard"
            element={
              user.role === "workforce_planner" ? <Dashboard /> : <AccessRestricted />
            }
          />
          <Route path="/people" element={<PeopleSearch meta={meta} />} />
          <Route path="/intake" element={<OpportunityIntake meta={meta} />} />
          <Route path="/ewa" element={<EWAApprovals />} />
          <Route path="*" element={<Navigate to={user.landing} replace />} />
        </Routes>
      </main>

      <Chatbot />
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="auth-shell">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    );
  }

  return <Shell />;
}
