import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";

export interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  /** Theme token used for the icon + sparkline accent, e.g. "var(--blue)". */
  color: string;
  /** Real numeric series for the sparkline; omitted when no series exists. */
  series?: number[];
}

/**
 * Reusable enterprise KPI card: circular icon, title, large value, subtitle,
 * an optional real-data sparkline and a three-dot menu. Presentation only —
 * the value/hint are passed straight through from the dashboard API.
 */
export function KpiCard({ icon: Icon, label, value, hint, color, series }: KpiCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <article className="kpi-card" style={{ ["--kpi-accent" as string]: color }}>
      <div className="kpi-card-top">
        <span className="kpi-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="kpi-menu" ref={menuRef}>
          <button
            type="button"
            className="kpi-menu-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${label} options`}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="kpi-menu-pop" role="menu">
              <span className="kpi-menu-label">{label}</span>
              <span className="kpi-menu-hint">{hint}</span>
            </div>
          )}
        </div>
      </div>

      <div className="kpi-card-body">
        <div className="kpi-text">
          <div className="kpi-title">{label}</div>
          <div className="kpi-value">{value}</div>
          <div className="kpi-hint">{hint}</div>
        </div>
        {series && series.length > 1 && (
          <div className="kpi-spark">
            <Sparkline data={series} color={color} />
          </div>
        )}
      </div>
    </article>
  );
}
