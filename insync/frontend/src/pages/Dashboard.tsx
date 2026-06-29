import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard, getPendingStaffing } from "../api";
import type { DashboardData, PendingOpportunity } from "../types";
import { Pill, Spinner } from "../ui";

const KPI_DEFS: { key: keyof DashboardData["metrics"]; label: string; hint: string; color: string }[] = [
  { key: "total_employees", label: "Total Employees", hint: "Across APAC, India & MENA", color: "var(--blue)" },
  { key: "bench", label: "Bench (Available Now)", hint: "Current Bench", color: "var(--green)" },
  { key: "partial_capacity", label: "Partial Capacity", hint: "Free FTE available", color: "var(--blue)" },
  { key: "rolling_off_30", label: "Rolling Off ≤30d", hint: "Available within 30 days", color: "var(--amber)" },
  { key: "rolling_off_60", label: "Rolling Off 31–60d", hint: "Available 31–60 days", color: "var(--amber)" },
  { key: "rolling_off_61_90", label: "Rolling Off 61–90d", hint: "Available 61–90 days", color: "var(--coral)" },
  { key: "allocated_over_90", label: "Allocated >90", hint: "Not near-term suitable", color: "var(--text-faint)" },
  { key: "booked", label: "Booked", hint: "Committed to engagements", color: "var(--coral)" },
];

const RISK_COLORS: Record<string, string> = {
  High: "#ff5b6e",
  Medium: "#f5b942",
  Low: "#34c98a",
  Unknown: "#6f8492",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pending, setPending] = useState<PendingOpportunity[]>([]);

  useEffect(() => {
    getDashboard().then(setData);
    getPendingStaffing()
      .then((r) => setPending(r.opportunities))
      .catch(() => setPending([]));
  }, []);

  if (!data) return <Spinner />;

  const riskData = Object.entries(data.bench_risk).map(([name, value]) => ({ name, value }));
  const forecast = data.supply_forecast.map((p) => ({
    week: p.week_start.slice(5),
    Bench: p.current_bench,
    Emerging: p.emerging_bench,
    Partial: p.partial_capacity,
  }));

  return (
    <>
      <div className="page-head">
        <h1>Workforce Overview</h1>
        <p>
          Current and upcoming supply across the region · snapshot {data.snapshot_date}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--coral)" }}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>
              🔔 Pending Staffing Requests <span className="pill coral">{pending.length}</span>
            </h3>
            <button className="btn ghost sm" onClick={() => navigate("/work")}>
              Open queue →
            </button>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}
          >
            {pending.slice(0, 6).map((o) => (
              <button
                key={o.project_id}
                className="card"
                style={{ background: "var(--navy-700)", textAlign: "left", cursor: "pointer" }}
                onClick={() => navigate(`/work?opportunity=${o.project_id}`)}
              >
                <div className="spread">
                  <strong>{o.title}</strong>
                  <Pill kind="amber">{o.status}</Pill>
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                  {o.domain || "—"} · {o.region || "—"}
                </div>
                <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                  {o.roles.map((r) => (
                    <span className="pill" key={r.role_name}>
                      {r.count}× {r.role_name}
                    </span>
                  ))}
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                  {o.expected_start_date ? `Start ${o.expected_start_date} · ` : ""}By {o.created_by || "—"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="kpi-grid">
        {KPI_DEFS.map((k) => (
          <div className="kpi" key={k.key} style={{ ["--accent" as string]: k.color }}>
            <div className="label">{k.label}</div>
            <div className="value">{data.metrics[k.key]}</div>
            <div className="hint">{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 22 }}>
        <div className="card">
          <h3>Upcoming Supply (12-week forecast)</h3>
          <p className="faint" style={{ fontSize: 12.5, margin: "4px 0 14px" }}>
            Bench, emerging roll-off and partial-capacity headcount over time.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={forecast}>
              <defs>
                <linearGradient id="gBench" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34c98a" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#34c98a" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gEmerg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4f35" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#ff4f35" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gPart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4da9e8" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#4da9e8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c3f4d" />
              <XAxis dataKey="week" stroke="#6f8492" fontSize={11} />
              <YAxis stroke="#6f8492" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#15212b",
                  border: "1px solid #2c3f4d",
                  borderRadius: 8,
                }}
              />
              <Area type="monotone" dataKey="Bench" stroke="#34c98a" fill="url(#gBench)" />
              <Area type="monotone" dataKey="Emerging" stroke="#ff4f35" fill="url(#gEmerg)" />
              <Area type="monotone" dataKey="Partial" stroke="#4da9e8" fill="url(#gPart)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Bench Risk</h3>
          <p className="faint" style={{ fontSize: 12.5, margin: "4px 0 6px" }}>
            People at risk of extended bench time.
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={riskData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {riskData.map((d) => (
                  <Cell key={d.name} fill={RISK_COLORS[d.name] ?? "#6f8492"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#15212b",
                  border: "1px solid #2c3f4d",
                  borderRadius: 8,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="row wrap" style={{ justifyContent: "center", gap: 14 }}>
            {riskData.map((d) => (
              <span key={d.name} className="row" style={{ fontSize: 12.5, gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: RISK_COLORS[d.name] ?? "#6f8492",
                  }}
                />
                {d.name} · {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 22 }}>
        <BreakdownCard title="Headcount by Department" data={data.by_department} accent="var(--blue)" />
        <BreakdownCard title="Bench by Discipline" data={data.bench_by_discipline} accent="var(--green)" />
      </div>
    </>
  );
}

function BreakdownCard({
  title,
  data,
  accent,
}: {
  title: string;
  data: Record<string, number>;
  accent: string;
}) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="card">
      <h3>{title}</h3>
      <div style={{ marginTop: 14 }}>
        {entries.map(([name, value]) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <div className="spread" style={{ fontSize: 13, marginBottom: 4 }}>
              <span>{name || "—"}</span>
              <span className="muted">{value}</span>
            </div>
            <div className="score-bar">
              <span style={{ width: `${(value / max) * 100}%`, background: accent }} />
            </div>
          </div>
        ))}
        {entries.length === 0 && <span className="faint">No data.</span>}
      </div>
    </div>
  );
}
