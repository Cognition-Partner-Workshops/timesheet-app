import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { fetchMe, getToken, setToken } from "./api";
import type { AuthUser, Role } from "./types";

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Restore a session from a persisted token on first load.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback((token: string, u: AuthUser) => {
    setToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Pages each role is allowed to open (requirement §5, §6).
export const ROLE_NAV: Record<Role, { to: string; label: string; icon: string }[]> = {
  workforce_planner: [
    { to: "/dashboard", label: "Dashboard", icon: "▣" },
    { to: "/people", label: "People Search", icon: "◷" },
    { to: "/intake", label: "Opportunity Intake", icon: "✦" },
    { to: "/ewa", label: "EWA Approvals", icon: "✓" },
  ],
  delivery_manager: [
    { to: "/people", label: "People Search", icon: "◷" },
    { to: "/intake", label: "Opportunity Intake", icon: "✦" },
    { to: "/ewa", label: "EWA Approvals", icon: "✓" },
  ],
  client_manager: [
    { to: "/people", label: "People Search", icon: "◷" },
    { to: "/intake", label: "Opportunity Intake", icon: "✦" },
    { to: "/ewa", label: "EWA Approvals", icon: "✓" },
  ],
};
