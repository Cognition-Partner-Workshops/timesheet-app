import { useState } from 'react'
import './App.css'
import {
  Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import {
  TrendingUp, DollarSign, Droplets, Users, Building2, Leaf,
  ChevronDown, ChevronUp, BarChart3, Globe, Factory, Zap
} from 'lucide-react'

// ── Aramco Financial Data (2020–2024) ──
const revenueData = [
  { year: '2020', revenue: 205, netIncome: 49, capex: 27 },
  { year: '2021', revenue: 359, netIncome: 110, capex: 32 },
  { year: '2022', revenue: 535, netIncome: 161, capex: 38 },
  { year: '2023', revenue: 440, netIncome: 121, capex: 45 },
  { year: '2024', revenue: 437, netIncome: 106, capex: 50 },
]

const productionData = [
  { year: '2020', oil: 9.2, gas: 8.9, total: 12.4 },
  { year: '2021', oil: 9.2, gas: 9.2, total: 12.7 },
  { year: '2022', oil: 10.6, gas: 9.5, total: 13.6 },
  { year: '2023', oil: 10.1, gas: 10.1, total: 13.5 },
  { year: '2024', oil: 9.5, gas: 10.6, total: 13.3 },
]

const dividendData = [
  { year: '2020', dividend: 75, special: 0 },
  { year: '2021', dividend: 75, special: 0 },
  { year: '2022', dividend: 78, special: 20 },
  { year: '2023', dividend: 81, special: 19 },
  { year: '2024', dividend: 85, special: 16 },
]

const segmentRevenue = [
  { name: 'Upstream', value: 62, color: '#0ea5e9' },
  { name: 'Downstream', value: 28, color: '#10b981' },
  { name: 'Chemicals', value: 7, color: '#f59e0b' },
  { name: 'Other', value: 3, color: '#8b5cf6' },
]

const sustainabilityData = [
  { metric: 'Carbon Intensity', y2020: 70, y2024: 55 },
  { metric: 'Flaring Reduction', y2020: 45, y2024: 72 },
  { metric: 'Renewables Capacity', y2020: 20, y2024: 65 },
  { metric: 'Water Recycling', y2020: 35, y2024: 58 },
  { metric: 'Methane Reduction', y2020: 50, y2024: 78 },
  { metric: 'Energy Efficiency', y2020: 40, y2024: 62 },
]

const globalPresence = [
  { region: 'Middle East', employees: 62000, facilities: 45 },
  { region: 'Asia Pacific', employees: 8500, facilities: 22 },
  { region: 'Americas', employees: 5200, facilities: 15 },
  { region: 'Europe', employees: 3800, facilities: 12 },
  { region: 'Africa', employees: 1500, facilities: 6 },
]

const milestones = [
  { year: '2020', event: 'Maintained stable production through global pandemic; Acquired 70% stake in SABIC for $69.1B' },
  { year: '2021', event: 'Record net income rebound to $110B; Pipeline Infrastructure deal raised $12.4B' },
  { year: '2022', event: 'All-time record profit of $161B; Became world\'s most valuable company at $2.4T market cap' },
  { year: '2023', event: 'Expanded gas production capacity; Acquired Valvoline\'s global products business' },
  { year: '2024', event: 'Largest global chemicals integration underway; Renewables investment accelerated to $1.5B' },
]

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

type TabKey = 'financial' | 'production' | 'dividends' | 'segments' | 'sustainability' | 'global'

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'financial', label: 'Financial Performance', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'production', label: 'Production', icon: <Droplets className="w-4 h-4" /> },
  { key: 'dividends', label: 'Dividends', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'segments', label: 'Business Segments', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'sustainability', label: 'Sustainability', icon: <Leaf className="w-4 h-4" /> },
  { key: 'global', label: 'Global Presence', icon: <Globe className="w-4 h-4" /> },
]

function KPICard({ icon, label, value, sub, trend }: { icon: React.ReactNode; label: string; value: string; sub: string; trend: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col gap-2 hover:shadow-lg transition-shadow border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="bg-sky-50 text-sky-600 rounded-xl p-2.5">{icon}</div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        <span className={`text-sm font-semibold flex items-center gap-0.5 mb-1 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
          {trend === 'up' ? <ChevronUp className="w-4 h-4" /> : trend === 'down' ? <ChevronDown className="w-4 h-4" /> : null}
          {sub}
        </span>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}:</span>
          <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('financial')
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null)
  const [heroImageError, setHeroImageError] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-sky-800 to-emerald-800 text-white">
        <div className="absolute inset-0 opacity-20">
          {!heroImageError ? (
            <img
                            src="https://images.unsplash.com/photo-1588011930968-c909a30fa8f4?w=1920&q=80"
                            alt="Oil refinery towers at twilight"
              className="w-full h-full object-cover"
              onError={() => setHeroImageError(true)}
            />
          ) : (
            <img
              src="https://placehold.co/1920x600/0c4a6e/ffffff/png?text=Saudi+Aramco"
              alt="Saudi Aramco placeholder"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
              <Factory className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Saudi Aramco</h1>
              <p className="text-sky-200 text-lg mt-1">Growth & Performance Dashboard</p>
            </div>
          </div>
          <p className="max-w-2xl text-lg text-sky-100 leading-relaxed">
            Explore five years of growth at the world's largest integrated energy company.
            Interactive charts covering financials, production, dividends, sustainability, and global operations from 2020 to 2024.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <KPICard icon={<DollarSign className="w-5 h-5" />} label="Revenue (2024)" value="$437B" sub="-0.7% YoY" trend="down" />
          <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Net Income (2024)" value="$106B" sub="-12.4% YoY" trend="down" />
          <KPICard icon={<Droplets className="w-5 h-5" />} label="Daily Production" value="13.3M boe/d" sub="+7.3% vs 2020" trend="up" />
          <KPICard icon={<Users className="w-5 h-5" />} label="Employees" value="~81,000" sub="+14% vs 2020" trend="up" />
        </section>

        {/* Tab Navigation */}
        <nav className="flex flex-wrap gap-2 mb-8 bg-white rounded-2xl shadow-sm p-2 border border-gray-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Chart Panels */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8 mb-10">
          {activeTab === 'financial' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Financial Performance</h2>
              <p className="text-gray-500 mb-6">Revenue, Net Income & Capital Expenditure (in Billion USD)</p>
              <ResponsiveContainer width="100%" height={420}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue ($B)" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="netIncome" name="Net Income ($B)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                  <Line type="monotone" dataKey="capex" name="CapEx ($B)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-sky-50 rounded-xl p-4">
                  <p className="text-sm text-sky-700 font-medium">5-Year Revenue Growth</p>
                  <p className="text-2xl font-bold text-sky-900">+113%</p>
                  <p className="text-xs text-sky-600">$205B (2020) to $437B (2024)</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-sm text-emerald-700 font-medium">Peak Net Income</p>
                  <p className="text-2xl font-bold text-emerald-900">$161B</p>
                  <p className="text-xs text-emerald-600">Achieved in 2022 - world record</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-sm text-amber-700 font-medium">CapEx Growth</p>
                  <p className="text-2xl font-bold text-amber-900">+85%</p>
                  <p className="text-xs text-amber-600">$27B (2020) to $50B (2024)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'production' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Production Output</h2>
              <p className="text-gray-500 mb-6">Oil & Gas Production (Million barrels of oil equivalent per day)</p>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={productionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="oil" name="Crude Oil (Mboe/d)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gas" name="Natural Gas (Mboe/d)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-sky-50 rounded-xl p-4 flex items-start gap-3">
                  <Droplets className="w-6 h-6 text-sky-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sky-900">Oil Capacity</p>
                    <p className="text-sm text-sky-700">Maintained world's largest spare capacity at 12M bbl/d</p>
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 flex items-start gap-3">
                  <Zap className="w-6 h-6 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900">Gas Expansion</p>
                    <p className="text-sm text-emerald-700">Gas production grew 19% from 2020 to 2024, becoming a strategic pillar</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dividends' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Dividend Distributions</h2>
              <p className="text-gray-500 mb-6">Base & Performance-Linked Dividends (Billion USD)</p>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={dividendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="dividend" name="Base Dividend ($B)" fill="#0ea5e9" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="special" name="Performance Dividend ($B)" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
              <div className="bg-gradient-to-r from-sky-50 to-amber-50 rounded-xl p-5 mt-6">
                <p className="font-semibold text-gray-900 mb-1">Dividend Highlights</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>Total dividends paid 2020-2024: <strong>$449B+</strong></li>
                  <li>Performance-linked dividends introduced in 2022</li>
                  <li>Base dividend grew 13% over 5 years</li>
                  <li>2024 total payout: <strong>$101B</strong> - one of the largest globally</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'segments' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Business Segments</h2>
              <p className="text-gray-500 mb-6">Revenue Breakdown by Business Segment (2024)</p>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={380}>
                  <PieChart>
                    <Pie
                      data={segmentRevenue}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={150}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {segmentRevenue.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 w-full lg:w-96">
                  {segmentRevenue.map((seg) => (
                    <div key={seg.name} className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{seg.name}</p>
                        <p className="text-sm text-gray-500">
                          {seg.name === 'Upstream' && 'Crude oil exploration, production & sales'}
                          {seg.name === 'Downstream' && 'Refining, distribution & marketing'}
                          {seg.name === 'Chemicals' && 'Petrochemicals via SABIC & affiliates'}
                          {seg.name === 'Other' && 'Technology, ventures & corporate'}
                        </p>
                      </div>
                      <span className="text-lg font-bold" style={{ color: seg.color }}>{seg.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sustainability' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sustainability Progress</h2>
              <p className="text-gray-500 mb-6">ESG Performance Index: 2020 vs 2024 (higher is better)</p>
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={sustainabilityData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Radar name="2020" dataKey="y2020" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
                      <Radar name="2024" dataKey="y2024" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 w-full lg:w-80">
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Leaf className="w-5 h-5 text-emerald-600" />
                      <p className="font-semibold text-emerald-900">Net Zero by 2050</p>
                    </div>
                    <p className="text-sm text-emerald-700">Aramco committed to achieving Scope 1 & 2 net-zero emissions by 2050</p>
                  </div>
                  <div className="bg-sky-50 rounded-xl p-4">
                    <p className="font-semibold text-sky-900">Carbon Capture</p>
                    <p className="text-sm text-sky-700">World's largest CCUS hub under development in Jubail - 44 MTPA capacity target</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="font-semibold text-amber-900">Hydrogen</p>
                    <p className="text-sm text-amber-700">Blue hydrogen production launched; targeting position as world's largest supplier</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'global' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Global Presence</h2>
              <p className="text-gray-500 mb-6">Employees & Facilities by Region</p>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={globalPresence} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis dataKey="region" type="category" width={120} tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="employees" name="Employees" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
                {globalPresence.map((r, i) => (
                  <div key={r.region} className="bg-gray-50 rounded-xl p-3 text-center">
                    <Building2 className="w-5 h-5 mx-auto mb-1" style={{ color: COLORS[i] }} />
                    <p className="text-xs text-gray-500">{r.region}</p>
                    <p className="text-lg font-bold text-gray-900">{r.facilities}</p>
                    <p className="text-xs text-gray-500">Facilities</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Timeline / Milestones */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Milestones</h2>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div
                key={m.year}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setExpandedMilestone(expandedMilestone === i ? null : i)}
              >
                <div className="flex items-center gap-4 p-5">
                  <div className="bg-sky-600 text-white rounded-xl px-4 py-2 font-bold text-lg shrink-0">
                    {m.year}
                  </div>
                  <p className={`text-gray-700 flex-1 ${expandedMilestone === i ? '' : 'line-clamp-1'}`}>
                    {m.event}
                  </p>
                  <div className="text-gray-400">
                    {expandedMilestone === i ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-400 py-8 border-t border-gray-100">
          <p>Data sourced from Saudi Aramco Annual Reports 2020-2024. Figures are approximate.</p>
          <p className="mt-1">Interactive Dashboard - Built {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  )
}

export default App
