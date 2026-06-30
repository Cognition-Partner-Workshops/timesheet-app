import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getRoles, signUp } from "../api";
import { useAuth } from "../auth";
import { AuthLayout } from "../components/AuthLayout";
import type { Role, RoleOption } from "../types";

export default function SignUp() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!role) {
      setError("Please select a role.");
      return;
    }
    setBusy(true);
    try {
      const res = await signUp({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      login(res.token, res.user);
      navigate(res.user.landing, { replace: true });
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.detail
        : null;
      setError(
        (typeof detail === "string" && detail) ||
          "Could not create your account."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">
        Choose the role that matches how you'll use TalentBridge.
      </p>

      <form onSubmit={submit} className="auth-form">
          <div>
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Lee"
              required
            />
          </div>
          <div>
            <label htmlFor="su_email">Email</label>
            <input
              id="su_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="auth-two-col">
            <div>
              <label htmlFor="su_pw">Password</label>
              <input
                id="su_pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <div>
              <label htmlFor="su_confirm">Confirm password</label>
              <input
                id="su_confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              required
            >
              <option value="" disabled>
                Select a role…
              </option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create Account"}
          </button>
        </form>

      <p className="auth-switch">
        Already have an account? <Link to="/signin">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
