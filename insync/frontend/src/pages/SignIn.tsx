import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { signIn } from "../api";
import { useAuth } from "../auth";
import { BrandMark } from "../components/BrandMark";

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="auth-shell">
      <div className="auth-card">
        <BrandMark />
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your TalentBridge workspace.</p>

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
            {busy ? "Signing in…" : "Sign In"}
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
      </div>
    </div>
  );
}
