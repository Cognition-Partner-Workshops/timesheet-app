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
import {
  Users,
  UserCheck,
  PieChart as PieIcon,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  UsersRound,
  ShieldCheck,
  Download,
  Calendar,
  ArrowRight,
  Building2,
  Layers,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDashboard, getPendingStaffing } from "../api";
import type { DashboardData, PendingOpportunity } from "../types";
import { Pill, Spinner } from "../ui";
import { KpiCard } from "../components/KpiCard";
import { ChartCard } from "../components/ChartCard";

type MetricKey = keyof DashboardData["metrics"];
type SeriesKey = "current_bench" | "partial_capacity" | "emerging_bench" | null;

const KPI_DEFS: {
  key: MetricKey;
  label: string;
  hint: string;
  color: string;
  icon: LucideIcon;
  series: SeriesKey;
}[] = [
  { key: "total_employees", label: "Total Employees", hint: "Across APAC, India & MENA", color: "var(--blue)", icon: Users, series: null },
  { key: "bench", label: "Bench (Available Now)", hint: "Current Bench", color: "var(--green)", icon: UserCheck, series: "current_bench" },
  { key: "partial_capacity", label: "Partial Capacity", hint: "Free FTE available", color: "var(--teal)", icon: PieIcon, series: "partial_capacity" },
  { key: "rolling_off_30", label: "Rolling Off ≤30d", hint: "Available within 30 days", color: "var(--violet)", icon: CalendarClock, series: "emerging_bench" },
  { key: "rolling_off_60", label: "Rolling Off 31–60d", hint: "Available 31–60 days", color: "var(--amber)", icon: CalendarDays, series: "emerging_bench" },
  { key: "rolling_off_61_90", label: "Rolling Off 61–90d", hint: "Available 61–90 days", color: "var(--red)", icon: CalendarRange, series: "emerging_bench" },
  { key: "allocated_over_90", label: "Allocated >90", hint: "Not near-term suitable", color: "var(--green)", icon: UsersRound, series: null },
  { key: "booked", label: "Booked", hint: "Committed to engagements", color: "var(--coral)", icon: ShieldCheck, series: null },
];

const RISK_COLORS: Record<string, string> = {
  High: "var(--red)",
  Medium: "var(--amber)",
  Low: "var(--green)",
  Unknown: "var(--text-faint)",
};

function exportReport(data: DashboardData) {
  const rows: string[] = ["Metric,Value"];
  KPI_DEFS.forEach((k) => rows.push(`"${k.label}",${data.metrics[k.key]}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workforce-overview-${data.snapshot_date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const riskTotal = riskData.reduce((s, d) => s + d.value, 0);
  const forecast = data.supply_forecast.map((p) => ({
    week: p.week_start.slice(5),
    Bench: p.current_bench,
    Emerging: p.emerging_bench,
    Partial: p.partial_capacity,
  }));
  const seriesFor = (key: SeriesKey): number[] | undefined =>
    key ? data.supply_forecast.map((p) => p[key]) : undefined;

  return (
    <>
      <div className="dash-head">
        <div className="dash-head-titles">
          <h1>Workforce Overview</h1>
          <p>Current and upcoming supply across the region · snapshot {data.snapshot_date}</p>
        </div>
        <div className="dash-head-actions">
          <button className="btn ghost icon-btn" onClick={() => exportReport(data)}>
            <Download size={16} /> Export report
          </button>
          <span className="date-pill" title="Current snapshot date">
            <Calendar size={15} /> {data.snapshot_date}
          </span>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card pending-card">
          <div className="spread">
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={17} /> Pending Staffing Requests <span className="pill coral">{pending.length}</span>
            </h3>
            <button className="btn ghost sm icon-btn" onClick={() => navigate("/work")}>
              Open queue <ArrowRight size={14} />
            </button>
          </div>
          <div className="pending-grid">
            {pending.slice(0, 6).map((o) => (
              <button
                key={o.project_id}
                className="card pending-item"
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
          <KpiCard
            key={k.key}
            icon={k.icon}
            label={k.label}
            value={data.metrics[k.key]}
            hint={k.hint}
            color={k.color}
            series={seriesFor(k.series)}
          />
        ))}
      </div>

      <div className="dash-charts">
        <ChartCard
          icon={Layers}
          title="Upcoming Supply (12-week forecast)"
          subtitle="Bench, emerging roll-off and partial-capacity headcount over time."
          action={
            <div className="chart-legend">
              <span className="lg-item"><i style={{ background: "var(--green)" }} /> Bench</span>
              <span className="lg-item"><i style={{ background: "var(--blue)" }} /> Partial Capacity</span>
              <span className="lg-item"><i style={{ background: "var(--violet)" }} /> Emerging Roll-off</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={272}>
            <AreaChart data={forecast} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="gBench" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--green)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--green)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="gEmerg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--violet)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="gPart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--blue)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--navy-800)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  color: "var(--text)",
                }}
              />
              <Area type="monotone" dataKey="Bench" stroke="var(--green)" strokeWidth={2} fill="url(#gBench)" />
              <Area type="monotone" dataKey="Partial" stroke="var(--blue)" strokeWidth={2} fill="url(#gPart)" />
              <Area type="monotone" dataKey="Emerging" stroke="var(--violet)" strokeWidth={2} fill="url(#gEmerg)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={PieIcon}
          title="Bench Risk"
          subtitle="People at risk of extended bench time."
        >
          <div className="donut-wrap">
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={riskData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {riskData.map((d) => (
                      <Cell key={d.name} stroke="none" fill={RISK_COLORS[d.name] ?? "var(--text-faint)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--navy-800)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      color: "var(--text)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="donut-num">{riskTotal}</span>
                <span className="donut-label">At Risk</span>
              </div>
            </div>
            <div className="risk-legend">
              {riskData.map((d) => (
                <div key={d.name} className="risk-row">
                  <span className="risk-dot" style={{ background: RISK_COLORS[d.name] ?? "var(--text-faint)" }} />
                  <span className="risk-name">{d.name} Risk</span>
                  <span className="risk-val">
                    {d.value} {riskTotal ? `(${((d.value / riskTotal) * 100).toFixed(1)}%)` : ""}
                  </span>
                </div>
              ))}
              <button className="risk-link icon-btn" onClick={() => navigate("/people")}>
                View risk details <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="dash-breakdowns">
        <BreakdownCard icon={Building2} title="Headcount by Department" unit="Headcount" data={data.by_department} accent="var(--green)" onViewAll={() => navigate("/people")} />
        <BreakdownCard icon={Layers} title="Bench by Discipline" unit="Bench" data={data.bench_by_discipline} accent="var(--blue)" onViewAll={() => navigate("/people")} />
      </div>
    </>
  );
}

function BreakdownCard({
  icon,
  title,
  unit,
  data,
  accent,
  onViewAll,
}: {
  icon: LucideIcon;
  title: string;
  unit: string;
  data: Record<string, number>;
  accent: string;
  onViewAll: () => void;
}) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <ChartCard
      icon={icon}
      title={title}
      action={
        <button className="view-all icon-btn" onClick={onViewAll}>
          View all <ArrowRight size={14} />
        </button>
      }
    >
      <div className="breakdown-head">
        <span>{title.includes("Department") ? "Department" : "Discipline"}</span>
        <span>{unit}</span>
      </div>
      <div className="breakdown-list">
        {entries.map(([name, value]) => (
          <div key={name} className="breakdown-row">
            <span className="breakdown-name">{name || "—"}</span>
            <div className="breakdown-bar">
              <span style={{ width: `${(value / max) * 100}%`, background: accent }} />
            </div>
            <span className="breakdown-val">{value}</span>
          </div>
        ))}
        {entries.length === 0 && <span className="faint">No data.</span>}
      </div>
    </ChartCard>
  );
}
