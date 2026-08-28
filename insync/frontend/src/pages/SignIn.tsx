import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { signIn } from "../api";
import { useAuth } from "../auth";
import { AuthLayout } from "../components/AuthLayout";
import type { Role } from "../types";

// Demo personas shown as selectable cards on the Sign In screen. Selecting one
// pre-fills the matching demo account so reviewers can sign straight in.
const PERSONAS: {
  role: Role;
  title: string;
  sub: string;
  hint: string;
  email: string;
}[] = [
  {
    role: "client_manager",
    title: "Client Manager",
    sub: "Opportunity owner",
    hint: "Create opportunities",
    email: "jenny@talentbridge.demo",
  },
  {
    role: "workforce_planner",
    title: "Workforce Planner",
    sub: "Staffing owner",
    hint: "Shortlist people",
    email: "sarah@talentbridge.demo",
  },
  {
    role: "delivery_manager",
    title: "Delivery Manager",
    sub: "Delivery reviewer",
    hint: "Approve delivery fit",
    email: "raj@talentbridge.demo",
  },
];

const DEMO_PASSWORD = "demo1234";

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choosePersona(p: (typeof PERSONAS)[number]) {
    setPersona(p.role);
    setEmail(p.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn(email.trim(), password);
      login(res.token, res.user);
      navigate(res.user.landing, { replace: true });
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.detail
        : null;
      setError(detail || "Could not sign in. Check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Choose a demo persona or enter credentials.</p>

      <div className="persona-grid">
        {PERSONAS.map((p) => (
          <button
            type="button"
            key={p.role}
            className={`persona-card ${persona === p.role ? "active" : ""}`}
            onClick={() => choosePersona(p)}
          >
            <span className="persona-role">{p.title}</span>
            <span className="persona-sub">{p.sub}</span>
            <span className="persona-hint">{p.hint}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="auth-form">
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Enter workspace"}
        </button>
      </form>

      <p className="auth-switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>

      <div className="auth-demo">
        <div className="auth-demo-title">Demo accounts (password: demo1234)</div>
        <div>sarah@talentbridge.demo · Workforce Planner</div>
        <div>raj@talentbridge.demo · Delivery Manager</div>
        <div>jenny@talentbridge.demo · Client Manager</div>
      </div>
    </AuthLayout>
  );
}
