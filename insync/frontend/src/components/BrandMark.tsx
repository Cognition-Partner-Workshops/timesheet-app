// TalentBridge wordmark + logo, reused on auth screens and the sidebar.
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <div className="logo">TB</div>
      <div>
        <div className="title">TalentBridge</div>
        <div className="sub">Workforce Planning</div>
      </div>
    </div>
  );
}
