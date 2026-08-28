import { useState } from 'react'
import './App.css'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts'
import { TrendingUp, DollarSign, Droplets, Globe, BarChart3, ChevronDown, ChevronUp, Fuel, Factory, Users } from 'lucide-react'

const revenueData = [
  { year: '2020', revenue: 204.85, netIncome: 49.0, operatingIncome: 78.1 },
  { year: '2021', revenue: 359.09, netIncome: 109.4, operatingIncome: 186.1 },
  { year: '2022', revenue: 535.18, netIncome: 161.1, operatingIncome: 275.0 },
  { year: '2023', revenue: 437.04, netIncome: 121.3, operatingIncome: 209.4 },
  { year: '2024', revenue: 437.11, netIncome: 106.2, operatingIncome: 197.5 },
]

const productionData = [
  { year: '2020', crude: 9.2, gas: 9.1, total: 12.4 },
  { year: '2021', crude: 9.2, gas: 9.2, total: 12.3 },
  { year: '2022', crude: 10.6, gas: 10.7, total: 13.6 },
  { year: '2023', crude: 10.0, gas: 11.0, total: 13.4 },
  { year: '2024', crude: 9.4, gas: 11.3, total: 13.1 },
]

const dividendData = [
  { year: '2020', dividend: 75.0, perShare: 0.36 },
  { year: '2021', dividend: 75.0, perShare: 0.36 },
  { year: '2022', dividend: 79.5, perShare: 0.38 },
  { year: '2023', dividend: 97.8, perShare: 0.47 },
  { year: '2024', dividend: 124.3, perShare: 0.60 },
]

const capexData = [
  { year: '2020', capex: 27.0 },
  { year: '2021', capex: 31.9 },
  { year: '2022', capex: 36.8 },
  { year: '2023', capex: 41.4 },
  { year: '2024', capex: 49.7 },
]

const segmentRevenue2024 = [
  { name: 'Upstream', value: 62, color: '#006C35' },
  { name: 'Downstream', value: 28, color: '#00A651' },
  { name: 'Corporate', value: 10, color: '#4CAF50' },
]

const keyMetrics = [
  { label: 'Revenue (2024)', value: '$437.1B', change: '+0.02%', icon: DollarSign, positive: true },
  { label: 'Net Income (2024)', value: '$106.2B', change: '-12.5%', icon: TrendingUp, positive: false },
  { label: 'Production', value: '13.1 MMBOE/d', change: '-2.2%', icon: Droplets, positive: false },
  { label: 'Dividends Paid', value: '$124.3B', change: '+27.1%', icon: Globe, positive: true },
]

const milestones = [
  { year: '2020', title: 'Resilience Through Crisis', description: 'Maintained $49B net income despite COVID-19 pandemic and oil price crash. Completed SABIC acquisition for $69.1B, becoming the world\'s fourth-largest chemical company.' },
  { year: '2021', title: 'Record Recovery', description: 'Net income surged 124% to $109.4B as oil demand rebounded. Announced ambition to achieve net-zero Scope 1 and 2 emissions by 2050.' },
  { year: '2022', title: 'Historic Highs', description: 'Achieved record $161.1B net income — the highest of any listed company globally. Revenue crossed $535B driven by high energy prices.' },
  { year: '2023', title: 'Strategic Expansion', description: 'Acquired Valvoline\'s global products business. Increased maximum sustainable capacity plans. Dividends rose 23% to $97.8B.' },
  { year: '2024', title: 'Diversification Push', description: 'Record dividends of $124.3B. Expanded LNG portfolio with global partnerships. Capital expenditure rose to $49.7B for growth projects and sustainability initiatives.' },
]

const tabs = ['Overview', 'Financials', 'Production', 'Investments'] as const
type Tab = typeof tabs[number]

function StatCard({ label, value, change, icon: Icon, positive }: {
  label: string; value: string; change: string; icon: React.ElementType; positive: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="p-3 rounded-lg bg-emerald-50">
          <Icon className="w-6 h-6 text-emerald-700" />
        </div>
        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
          {positive ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-gray-900" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Fuel className="w-4 h-4 text-emerald-300" />
                <span className="text-emerald-200 text-sm font-medium">Saudi Arabian Oil Company</span>
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Aramco's Growth
                <span className="block text-emerald-300">2020 — 2024</span>
              </h1>
              <p className="text-lg text-emerald-100/80 max-w-xl mb-8 leading-relaxed">
                An interactive exploration of Saudi Aramco's financial performance, production milestones,
                and strategic investments over the past five years.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3">
                  <Factory className="w-5 h-5 text-emerald-300" />
                  <div>
                    <p className="text-white font-semibold text-sm">World's Largest</p>
                    <p className="text-emerald-200 text-xs">Oil Producer</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3">
                  <DollarSign className="w-5 h-5 text-emerald-300" />
                  <div>
                    <p className="text-white font-semibold text-sm">$1.97 Trillion</p>
                    <p className="text-emerald-200 text-xs">Market Cap (2024)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3">
                  <Users className="w-5 h-5 text-emerald-300" />
                  <div>
                    <p className="text-white font-semibold text-sm">72,000+</p>
                    <p className="text-emerald-200 text-xs">Employees</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full max-w-lg">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-emerald-200 text-sm font-semibold mb-4 uppercase tracking-wider">5-Year Revenue Trend ($ Billions)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" stroke="#a7f3d0" tick={{ fill: '#a7f3d0', fontSize: 12 }} />
                    <YAxis stroke="#a7f3d0" tick={{ fill: '#a7f3d0', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#064e3b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      labelStyle={{ color: '#a7f3d0' }}
                      formatter={(value: number) => [`$${value}B`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fill="url(#heroGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-emerald-700 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-emerald-700" />
                Key Metrics at a Glance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {keyMetrics.map((metric) => (
                  <StatCard key={metric.label} {...metric} />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Revenue vs Net Income ($ Billions)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 13 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [`$${value}B`, name === 'revenue' ? 'Revenue' : name === 'netIncome' ? 'Net Income' : 'Operating Income']}
                  />
                  <Legend formatter={(value: string) => value === 'revenue' ? 'Revenue' : value === 'netIncome' ? 'Net Income' : 'Operating Income'} />
                  <Bar dataKey="revenue" fill="#006C35" radius={[6, 6, 0, 0]} name="revenue" />
                  <Line type="monotone" dataKey="netIncome" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5, fill: '#f59e0b' }} name="netIncome" />
                  <Line type="monotone" dataKey="operatingIncome" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6' }} strokeDasharray="5 5" name="operatingIncome" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Five Years of Milestones</h2>
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-emerald-200" />
                <div className="space-y-8">
                  {milestones.map((ms, idx) => (
                    <div
                      key={ms.year}
                      className="relative pl-20 cursor-pointer"
                      onClick={() => setSelectedMilestone(selectedMilestone === idx ? null : idx)}
                    >
                      <div className={`absolute left-5 w-7 h-7 rounded-full border-4 transition-all duration-300 ${
                        selectedMilestone === idx
                          ? 'bg-emerald-600 border-emerald-300 scale-125'
                          : 'bg-white border-emerald-500'
                      }`} />
                      <div className={`bg-white rounded-xl p-6 shadow-md border transition-all duration-300 hover:shadow-lg ${
                        selectedMilestone === idx ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-100'
                      }`}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-emerald-700 font-bold text-lg">{ms.year}</span>
                          <span className="text-gray-900 font-semibold text-lg">{ms.title}</span>
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ${
                          selectedMilestone === idx ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <p className="text-gray-600 leading-relaxed mt-2">{ms.description}</p>
                        </div>
                        {selectedMilestone !== idx && (
                          <p className="text-gray-400 text-sm mt-1">Click to expand</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financials Tab */}
        {activeTab === 'Financials' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Revenue Trend ($ Billions)</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006C35" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#006C35" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                    <YAxis tick={{ fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                      formatter={(value: number) => [`$${value}B`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#006C35" strokeWidth={3} fill="url(#revenueGrad)" dot={{ r: 5, fill: '#006C35' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Net Income ($ Billions)</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                    <YAxis tick={{ fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                      formatter={(value: number) => [`$${value}B`, 'Net Income']}
                    />
                    <Bar dataKey="netIncome" fill="#006C35" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Dividend Growth ($ Billions)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={dividendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis yAxisId="left" tick={{ fill: '#6b7280' }} label={{ value: 'Total ($B)', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280' }} label={{ value: 'Per Share ($)', angle: 90, position: 'insideRight', fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                    formatter={(value: number, name: string) => [name === 'dividend' ? `$${value}B` : `$${value}`, name === 'dividend' ? 'Total Dividends' : 'Per Share']}
                  />
                  <Legend formatter={(value: string) => value === 'dividend' ? 'Total Dividends' : 'Per Share'} />
                  <Bar yAxisId="left" dataKey="dividend" fill="#006C35" radius={[8, 8, 0, 0]} name="dividend" />
                  <Line yAxisId="right" type="monotone" dataKey="perShare" stroke="#f59e0b" strokeWidth={3} dot={{ r: 6, fill: '#f59e0b' }} name="perShare" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">2024 Revenue by Segment</h3>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={segmentRevenue2024}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {segmentRevenue2024.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  {segmentRevenue2024.map((segment) => (
                    <div key={segment.name} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: segment.color }} />
                      <div>
                        <p className="font-semibold text-gray-900">{segment.name}</p>
                        <p className="text-sm text-gray-500">{segment.value}% of revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Production Tab */}
        {activeTab === 'Production' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 text-center">
                <Droplets className="w-10 h-10 text-emerald-700 mx-auto mb-3" />
                <p className="text-3xl font-bold text-gray-900">9.4</p>
                <p className="text-sm text-gray-500 mt-1">Million barrels/day (Crude, 2024)</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 text-center">
                <Fuel className="w-10 h-10 text-emerald-700 mx-auto mb-3" />
                <p className="text-3xl font-bold text-gray-900">11.3</p>
                <p className="text-sm text-gray-500 mt-1">Billion scf/day (Gas, 2024)</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 text-center">
                <Factory className="w-10 h-10 text-emerald-700 mx-auto mb-3" />
                <p className="text-3xl font-bold text-gray-900">13.1</p>
                <p className="text-sm text-gray-500 mt-1">MMBOE/d Total (2024)</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Crude Oil vs Gas Production</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} label={{ value: 'MMBOE/d or Bscf/d', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }} />
                  <Legend />
                  <Bar dataKey="crude" name="Crude Oil (M bbl/d)" fill="#006C35" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="gas" name="Natural Gas (Bscf/d)" fill="#00A651" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Total Hydrocarbon Production (MMBOE/d)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} domain={[11, 14]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                    formatter={(value: number) => [`${value} MMBOE/d`, 'Total Production']}
                  />
                  <Line type="monotone" dataKey="total" stroke="#006C35" strokeWidth={4} dot={{ r: 8, fill: '#006C35', strokeWidth: 3, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 rounded-xl p-8 text-white">
              <h3 className="text-xl font-bold mb-4">Production Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5">
                  <p className="font-semibold text-emerald-200 mb-2">Gas Expansion Strategy</p>
                  <p className="text-emerald-100/80 text-sm leading-relaxed">Natural gas production grew 24% from 9.1 Bscf/d in 2020 to 11.3 Bscf/d in 2024, reflecting Aramco's strategic pivot toward gas as a transition fuel.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5">
                  <p className="font-semibold text-emerald-200 mb-2">OPEC+ Compliance</p>
                  <p className="text-emerald-100/80 text-sm leading-relaxed">Crude oil production fluctuated between 9.2-10.6 M bbl/d, reflecting Saudi Arabia's leadership in OPEC+ production quota management to stabilize global markets.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investments Tab */}
        {activeTab === 'Investments' && (
          <div className="space-y-10">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Capital Expenditure Growth ($ Billions)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={capexData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                    formatter={(value: number) => [`$${value}B`, 'CapEx']}
                  />
                  <Bar dataKey="capex" name="Capital Expenditure" fill="#006C35" radius={[8, 8, 0, 0]}>
                    {capexData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === capexData.length - 1 ? '#006C35' : '#00A651'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-gray-500 text-sm mt-4">CapEx increased 84% from $27B in 2020 to $49.7B in 2024, reflecting massive investments in capacity expansion and sustainability.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-emerald-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">SABIC Acquisition</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Completed the $69.1B acquisition of a 70% stake in SABIC in 2020, making Aramco one of the world's largest diversified chemical companies.</p>
                <p className="text-emerald-700 font-semibold mt-3 text-sm">$69.1B deal value</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Fuel className="w-6 h-6 text-blue-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">LNG Portfolio Expansion</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Signed agreements for LNG projects globally, including partnerships in the US and Australia. Targeting significant LNG capacity by 2030.</p>
                <p className="text-blue-700 font-semibold mt-3 text-sm">Global LNG partnerships</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-amber-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">Sustainability Initiatives</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Committed to net-zero Scope 1 & 2 emissions by 2050. Investing in carbon capture, hydrogen, and renewable energy programs.</p>
                <p className="text-amber-700 font-semibold mt-3 text-sm">Net-zero by 2050</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Droplets className="w-6 h-6 text-purple-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">Jafurah Gas Field</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Developing Saudi Arabia's largest unconventional gas field with expected production of 2 Bscf/d by 2025, growing the kingdom's gas self-sufficiency.</p>
                <p className="text-purple-700 font-semibold mt-3 text-sm">2 Bscf/d target capacity</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                  <Factory className="w-6 h-6 text-red-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">Downstream Integration</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Expanding refining capacity and petrochemical integration globally, including projects in China, India, and South Korea.</p>
                <p className="text-red-700 font-semibold mt-3 text-sm">Global refining expansion</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-teal-700" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-2">Digital Transformation</h4>
                <p className="text-gray-600 text-sm leading-relaxed">Investing heavily in AI, IoT, and digital twin technology across operations. Launched the Aramco Digital Company for tech ventures.</p>
                <p className="text-teal-700 font-semibold mt-3 text-sm">AI-powered operations</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 rounded-xl p-8 text-white">
              <h3 className="text-xl font-bold mb-4">Investment Strategy Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-300">$187B+</p>
                  <p className="text-emerald-200 text-sm mt-1">Total CapEx (2020-2024)</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-300">84%</p>
                  <p className="text-emerald-200 text-sm mt-1">CapEx Growth</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-300">$451B+</p>
                  <p className="text-emerald-200 text-sm mt-1">Total Dividends Paid</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-300">66%</p>
                  <p className="text-emerald-200 text-sm mt-1">Dividend Growth</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p className="text-white font-bold text-lg">Aramco Growth Dashboard</p>
              <p className="text-sm mt-1">An interactive visualization of Saudi Aramco's 5-year performance</p>
            </div>
            <div className="text-sm text-right">
              <p>Data sourced from Aramco Annual Reports (2020-2024)</p>
              <p className="mt-1">Images from Unsplash. For informational purposes only.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
