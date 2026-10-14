import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

// Shared marketing-hero + card shell used by both Sign In and Sign Up so the
// two screens share an identical background and template.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <div className="auth-hero">
        <BrandMark />
        <div className="auth-eyebrow">TalentBridge Workforce Planning</div>
        <h1 className="auth-hero-title">
          Right people, routed through the right approval path.
        </h1>
        <p className="auth-hero-sub">
          Client Managers open opportunities, Workforce Planners propose people,
          Delivery Managers validate fit, and approved staffing moves to booking.
        </p>
      </div>
      <div className="auth-panel">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
