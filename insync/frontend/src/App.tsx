import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getMeta } from "./api";
import type { Meta } from "./types";
import { ROLE_NAV, useAuth } from "./auth";
import { useTheme } from "./theme";
import Dashboard from "./pages/Dashboard";
import PeopleSearch from "./pages/PeopleSearch";
import OpportunityIntake from "./pages/OpportunityIntake";
import EWAApprovals from "./pages/EWAApprovals";
import WorkQueue from "./pages/WorkQueue";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AccessRestricted from "./pages/AccessRestricted";
import Chatbot from "./components/Chatbot";
import NotificationBell from "./components/NotificationBell";
import { BrandMark } from "./components/BrandMark";
import { Spinner } from "./ui";
import {
  LayoutDashboard,
  Search,
  PlusCircle,
  CheckCircle2,
  Briefcase,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  ChevronsLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/work": Briefcase,
  "/people": Search,
  "/intake": PlusCircle,
  "/ewa": CheckCircle2,
};

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function SidebarSettings({ collapsed }: { collapsed: boolean }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="sidebar-settings" ref={ref}>
      <button
        className={`nav-link ${open ? "active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nav-icon"><SettingsIcon size={18} /></span>
        {!collapsed && <span className="nav-label">Settings</span>}
      </button>
      {open && (
        <div className="settings-pop card" role="menu">
          <button className="settings-item" role="menuitem" onClick={toggle}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </button>
          <button
            className="settings-item"
            role="menuitem"
            onClick={() => {
              logout();
              navigate("/signin", { replace: true });
            }}
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  if (!user) return null;
  const nav = ROLE_NAV[user.role];

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <BrandMark />
        <nav className="sidebar-nav">
          {nav.map((n) => {
            const Icon = NAV_ICONS[n.to] ?? LayoutDashboard;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                title={n.label}
              >
                <span className="nav-icon"><Icon size={18} /></span>
                <span className="nav-label">{n.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {!collapsed && (
            <div className="sidebar-tag">
              Right People. Right Opportunity.
              <br />
              AI surfaces evidence — people decide.
              {meta && (
                <>
                  <br />
                  <br />
                  Data snapshot: {meta.snapshot_date}
                  <br />
                  AI: {meta.ai_enabled ? `live (${meta.ai_provider})` : "mock mode"}
                  <br />
                  Retrieval: {meta.retrieval_enabled ? "pgvector" : "fallback"}
                </>
              )}
            </div>
          )}
          <div className="sidebar-foot-row">
            <SidebarSettings collapsed={collapsed} />
            <button
              className="collapse-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((c) => !c)}
            >
              <ChevronsLeft size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <NotificationBell />
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
          <Route path="/work" element={<WorkQueue meta={meta} />} />
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
