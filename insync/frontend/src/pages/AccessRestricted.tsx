import { Link } from "react-router-dom";
import { useAuth } from "../auth";

export default function AccessRestricted() {
  const { user } = useAuth();
  const landing = user?.landing || "/people";
  return (
    <div className="restricted">
      <div className="restricted-card card">
        <div className="restricted-icon">🔒</div>
        <h1>Access restricted</h1>
        <p className="muted">
          The Dashboard is available to Workforce Planners only. Your role
          {user ? ` (${user.role_label})` : ""} doesn't have access to this page.
        </p>
        <Link className="btn primary" to={landing}>
          Go to my workspace
        </Link>
      </div>
    </div>
  );
}
