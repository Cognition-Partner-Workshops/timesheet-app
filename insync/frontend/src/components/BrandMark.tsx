import logoDark from "../assets/talentbridge-logo-dark.png";
import logoLight from "../assets/talentbridge-logo-light.png";

// TalentBridge logo lockup. The supplied artwork ships a dark- and a
// light-background variant; we render both and let CSS reveal the one that
// matches the active theme so the logo always sits cleanly on the surface.
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <img className="brand-logo brand-logo-dark" src={logoDark} alt="TalentBridge — Workforce Planning" />
      <img className="brand-logo brand-logo-light" src={logoLight} alt="TalentBridge — Workforce Planning" />
    </div>
  );
}
