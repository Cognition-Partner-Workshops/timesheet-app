// Small shared presentational helpers used across pages.
import type { ReactNode } from "react";

export function Spinner() {
  return (
    <div className="center-load">
      <div className="spinner" />
    </div>
  );
}

// Colour mapping for availability categories (consistent across the app).
export function availabilityClass(category: string | null): string {
  switch (category) {
    case "Current Bench":
      return "green";
    case "Partial Capacity":
      return "blue";
    case "Rolling Off 0-30":
      return "amber";
    case "Rolling Off 31-60":
    case "Rolling Off 61-90":
      return "coral";
    case "Allocated >90":
      return "gray";
    default:
      return "gray";
  }
}

export function confidenceClass(conf: string): string {
  if (conf === "High") return "green";
  if (conf === "Medium") return "amber";
  return "red";
}

export function Pill({ children, kind }: { children: ReactNode; kind?: string }) {
  return <span className={`pill ${kind ?? ""}`}>{children}</span>;
}

export function ScoreBar({ value }: { value: number }) {
  return (
    <div className="score-bar" title={`${value}/100`}>
      <span style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function scoreColor(value: number): string {
  if (value >= 75) return "var(--green)";
  if (value >= 55) return "var(--amber)";
  return "var(--red)";
}
