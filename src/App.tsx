import { useState } from 'react'
import './App.css'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  GraduationCap, Users, BookOpen, Award, TrendingUp, Building2,
  Globe, FlaskConical, ChevronDown, ChevronUp, BarChart3, Target,
  Search, UserCheck
} from 'lucide-react'

const KSU_GREEN = '#006747'
const KSU_GOLD = '#C4972F'
const KSU_TEAL = '#0098A6'
const KSU_LIGHT = '#E8F5E9'
const CHART_COLORS = [KSU_GREEN, KSU_GOLD, KSU_TEAL, '#2E7D32', '#FF8F00', '#00695C']

const enrollmentData = [
  { year: '2021', undergraduate: 620, graduate: 85, total: 705 },
  { year: '2022', undergraduate: 710, graduate: 110, total: 820 },
  { year: '2023', undergraduate: 790, graduate: 135, total: 925 },
  { year: '2024', undergraduate: 870, graduate: 160, total: 1030 },
  { year: '2025', undergraduate: 940, graduate: 195, total: 1135 },
]

const facultyData = [
  { year: '2021', professors: 8, associateProfessors: 6, assistantProfessors: 20, lecturers: 14, total: 48 },
  { year: '2022', professors: 9, associateProfessors: 7, assistantProfessors: 22, lecturers: 15, total: 53 },
  { year: '2023', professors: 10, associateProfessors: 7, assistantProfessors: 23, lecturers: 16, total: 56 },
  { year: '2024', professors: 10, associateProfessors: 8, assistantProfessors: 25, lecturers: 17, total: 60 },
  { year: '2025', professors: 11, associateProfessors: 8, assistantProfessors: 26, lecturers: 18, total: 75 },
]

const researchData = [
  { year: '2021', publications: 85, citations: 920, fundedProjects: 12, conferences: 18 },
  { year: '2022', publications: 112, citations: 1340, fundedProjects: 18, conferences: 24 },
  { year: '2023', publications: 145, citations: 1890, fundedProjects: 25, conferences: 31 },
  { year: '2024', publications: 178, citations: 2560, fundedProjects: 32, conferences: 38 },
  { year: '2025', publications: 215, citations: 3200, fundedProjects: 40, conferences: 45 },
]

const graduationData = [
  { year: '2021', bachelorGraduates: 145, masterGraduates: 22, phdGraduates: 5, employmentRate: 82 },
  { year: '2022', bachelorGraduates: 168, masterGraduates: 28, phdGraduates: 7, employmentRate: 85 },
  { year: '2023', bachelorGraduates: 192, masterGraduates: 35, phdGraduates: 9, employmentRate: 88 },
  { year: '2024', bachelorGraduates: 215, masterGraduates: 42, phdGraduates: 12, employmentRate: 91 },
  { year: '2025', bachelorGraduates: 240, masterGraduates: 50, phdGraduates: 15, employmentRate: 93 },
]

const programDistribution = [
  { name: 'BS in IS', value: 55 },
  { name: 'MS in IS', value: 20 },
  { name: 'PhD in IS', value: 8 },
  { name: 'Diploma Programs', value: 10 },
  { name: 'Executive Programs', value: 7 },
]

const radarData = [
  { metric: 'Teaching Quality', y2021: 72, y2025: 92 },
  { metric: 'Research Output', y2021: 65, y2025: 90 },
  { metric: 'Industry Links', y2021: 58, y2025: 85 },
  { metric: 'Intl Collaboration', y2021: 50, y2025: 82 },
  { metric: 'Student Satisfaction', y2021: 70, y2025: 88 },
  { metric: 'Innovation', y2021: 55, y2025: 87 },
]

const partnershipData = [
  { year: '2021', industry: 8, academic: 12, international: 5 },
  { year: '2022', industry: 12, academic: 16, international: 8 },
  { year: '2023', industry: 18, academic: 20, international: 12 },
  { year: '2024', industry: 25, academic: 25, international: 18 },
  { year: '2025', industry: 34, academic: 30, international: 24 },
]

interface FacultyMember {
  name: string
  rank: string
  office?: string
  tel?: string
  url?: string
}

const facultyMembers: FacultyMember[] = [
  { name: 'Prof. Dr. Abdulrahman Mirza', rank: 'Professor', office: '31|2099', tel: '4676606', url: 'http://faculty.ksu.edu.sa/amirza' },
  { name: 'Prof. Dr. Ahmed Al Sanad', rank: 'Professor', office: '31|2043', tel: '4676606', url: 'http://fac.ksu.edu.sa/aasanad' },
  { name: 'Prof. Dr. Alaaedin Mokhtar', rank: 'Professor', office: '31|2034', tel: '4676591', url: 'http://faculty.ksu.edu.sa/ahafez' },
  { name: 'Prof. Dr. Hmood Al-Dossari', rank: 'Professor', office: '31|2052', tel: '4697333', url: 'http://fac.ksu.edu.sa/hzaldossari' },
  { name: 'Prof. Dr. Hussam Ramadhan', rank: 'Professor', office: '31|2111', tel: '4696195', url: 'http://faculty.ksu.edu.sa/hussam' },
  { name: 'Prof. Dr. Jawad A Berri', rank: 'Professor', office: '31|2028', tel: '4676750', url: 'https://staff.ksu.edu.sa/jberri/' },
  { name: 'Prof. Dr. Majed AlSaud', rank: 'Professor', office: '31|2019', tel: '4676605', url: 'http://faculty.ksu.edu.sa/8977' },
  { name: 'Prof. Dr. Mehmet Sabih Aksoy', rank: 'Professor', office: '31|2108', tel: '4677697', url: 'http://faculty.ksu.edu.sa/msaksoy/home' },
  { name: 'Prof. Dr. Mohammad Mehedi Hassan', rank: 'Professor', office: '31|2098', tel: '4695202' },
  { name: 'Prof. Dr. Murad Ykhlef', rank: 'Professor', office: '31|2035', tel: '4675188', url: 'http://fac.ksu.edu.sa/ykhlef' },
  { name: 'Prof. Dr. Sultan AlYahya', rank: 'Professor', office: '31|2031', tel: '4676583', url: 'http://fac.ksu.edu.sa/sualyahya/home' },
  { name: 'Dr. Ahmed AlTurki', rank: 'Associate Professor', office: '31|2038', url: 'http://fac.ksu.edu.sa/ahmalturki' },
  { name: 'Dr. AlMetwally Mostafa', rank: 'Associate Professor', office: '31|2054', tel: '4696192', url: 'http://fac.ksu.edu.sa/almetwaly/home' },
  { name: 'Dr. Amerah Abdulrahman Alobrah', rank: 'Associate Professor', office: '06|T028', tel: '8056841' },
  { name: 'Dr. Areej A. Alhogail', rank: 'Associate Professor', office: '06|108', tel: '8055515', url: 'https://faculty.ksu.edu.sa/Aalhogail/' },
  { name: 'Dr. Bader Al Khamis', rank: 'Associate Professor', office: '31|2152', tel: '4696315', url: 'http://fac.ksu.edu.sa/balkhamees' },
  { name: 'Dr. Hessah AlSalamah', rank: 'Associate Professor', office: '06|T011', tel: '8052668', url: 'http://fac.ksu.edu.sa/halsalamah' },
  { name: 'Dr. Mohammed AlNuem', rank: 'Associate Professor', office: '31|2101', tel: '4676394', url: 'http://faculty.ksu.edu.sa/malnuem' },
  { name: 'Dr. Shada AlSalamah', rank: 'Associate Professor', office: '06|6B96', tel: '8056547', url: 'http://fac.ksu.edu.sa/saalsalamah' },
  { name: 'Dr. AbdulAziz Saleh AlAjaji', rank: 'Assistant Professor' },
  { name: 'Dr. AbdulAziz Saleh AlMaslukh', rank: 'Assistant Professor', office: '31|2030' },
  { name: 'Dr. Abdulrhman A. Bin Rabiah', rank: 'Assistant Professor', url: 'http://fac.ksu.edu.sa/abalrabiah' },
  { name: 'Dr. Abdulrahman AlOthaim', rank: 'Assistant Professor', office: '31|2026', tel: '4695203', url: 'http://fac.ksu.edu.sa/othaim' },
  { name: 'Dr. Abdulrahman AlShareef', rank: 'Assistant Professor' },
  { name: 'Dr. Abdulsalam AlSunaidi', rank: 'Assistant Professor' },
  { name: 'Dr. Ahmed Abdullah Alhamed', rank: 'Assistant Professor', office: '31|2038', tel: '4676605', url: 'https://portal.ksu.edu.sa/aalhamed' },
  { name: 'Dr. Amal Abdulrahman Alazba', rank: 'Assistant Professor' },
  { name: 'Dr. Areej AlOkaili', rank: 'Assistant Professor', office: '6T23', tel: '8052732', url: 'http://fac.ksu.edu.sa/aalokaili/home' },
  { name: 'Dr. Arwa AlTameem', rank: 'Assistant Professor', office: '6T24', tel: '8055275', url: 'http://fac.ksu.edu.sa/araltameem/home' },
  { name: 'Dr. Arwa AlRomih', rank: 'Assistant Professor' },
  { name: 'Dr. Aseel AlTurki', rank: 'Assistant Professor', office: '6T66', tel: '8052672', url: 'http://fac.ksu.edu.sa/afalturki' },
  { name: 'Dr. Faisal AlMisned', rank: 'Assistant Professor', office: '31|2030', url: 'http://fac.ksu.edu.sa/falmisned/home' },
  { name: 'Dr. Hamad Abdulrahman AlSaleh', rank: 'Assistant Professor' },
  { name: 'Dr. Mohammed AlRokayan', rank: 'Assistant Professor', office: '31|2038', url: 'http://fac.ksu.edu.sa/malrokayan' },
  { name: 'Dr. Mohammed Basil AlMukaynizi', rank: 'Assistant Professor', url: 'https://fac.ksu.edu.sa/malmukaynizi/' },
  { name: 'Dr. Muhammad Shoaib', rank: 'Assistant Professor', office: '31|2042', tel: '4698722', url: 'https://fac.ksu.edu.sa/muhshoaib/home' },
  { name: 'Dr. Nasser Ibrahim Al-Lheeib', rank: 'Assistant Professor', url: 'https://fac.ksu.edu.sa/nallheeib/' },
  { name: 'Dr. Nouf AlDreas', rank: 'Assistant Professor', office: '6T53', url: 'https://faculty.ksu.edu.sa/ar/nmaldrees' },
  { name: 'Dr. Ohoud AlYemni', rank: 'Assistant Professor', office: '6S6', tel: '8052753' },
  { name: 'Dr. Omar AlRwais', rank: 'Assistant Professor', office: '31|2080', tel: '4697412', url: 'http://fac.ksu.edu.sa/oalrwais' },
  { name: 'Dr. Rana Abaalkhail', rank: 'Assistant Professor', office: '06|T39', tel: '8059025', url: 'https://fac.ksu.edu.sa/rabaalkhail/' },
  { name: 'Dr. Saad Saleh Al-Aboodi', rank: 'Assistant Professor', office: '31|2025', tel: '4695201', url: 'http://fac.ksu.edu.sa/salaboodi' },
  { name: 'Dr. Sarah AlBassam', rank: 'Assistant Professor', office: '06|109', url: 'https://faculty.ksu.edu.sa/salbassam/' },
  { name: 'Dr. Shatha AlTammami', rank: 'Assistant Professor' },
  { name: 'Dr. Yazeed Ibrahim AlAbdulkarim', rank: 'Assistant Professor', office: '31|2101', url: 'https://faculty.ksu.edu.sa/yalabdulkarim/' },
  { name: 'L. Abdallah AlNajim', rank: 'Lecturer' },
  { name: 'L. Abdulaziz AlHadlag', rank: 'Lecturer' },
  { name: 'L. Abdulrhman M. AlDkheel', rank: 'Lecturer' },
  { name: 'L. Afnan AlSadhan', rank: 'Lecturer', office: '6S6', tel: '8052589', url: 'http://faculty.ksu.edu.sa/aalsadhan' },
  { name: 'L. Aseel AlDabjan', rank: 'Lecturer', url: 'https://faculty.ksu.edu.sa/ar/aaldabjan' },
  { name: 'L. Ashraf Youssef', rank: 'Lecturer', office: '31|2118', url: 'http://fac.ksu.edu.sa/ashraf' },
  { name: 'L. Bodoor AlFares', rank: 'Lecturer', office: '6T66', tel: '8052960', url: 'http://fac.ksu.edu.sa/balfares/home' },
  { name: 'L. Gamal Al-Sayed', rank: 'Lecturer', office: '31|2155', tel: '4675964', url: 'http://faculty.ksu.edu.sa/Gamal' },
  { name: 'L. Hussain Ali Hazazi', rank: 'Lecturer' },
  { name: 'L. Lubna Yousef AlKhalil', rank: 'Lecturer', office: '6S31', tel: '8058689', url: 'https://faculty.ksu.edu.sa/ar/lalkhalil' },
  { name: 'L. Maram Ahmad AlAmri', rank: 'Lecturer', office: '6T90', tel: '8058462', url: 'https://fac.ksu.edu.sa/maalamri/home' },
  { name: 'L. Meshal Nasser Binnasban', rank: 'Lecturer', office: '31|63' },
  { name: 'L. Monirah Abdullah AlAjlan', rank: 'Lecturer', office: '6S6', tel: '8052590', url: 'https://faculty.ksu.edu.sa/ar/maalajlan' },
  { name: 'L. Mourad Benchikh', rank: 'Lecturer', office: '31|2118', url: 'http://faculty.ksu.edu.sa/benchikhm' },
  { name: 'L. Nora Ibrahim AlAqeel', rank: 'Lecturer', office: '6S13', tel: '8051336', url: 'http://fac.ksu.edu.sa/nialaqeel/home' },
  { name: 'L. Nourah AlQahtani', rank: 'Lecturer', office: '6T52', tel: '8055079', url: 'https://faculty.ksu.edu.sa/en/noalqahtani' },
  { name: 'L. Tahani AlManie', rank: 'Lecturer' },
  { name: 'L. Yasser Ali Reyad Ali', rank: 'Lecturer', office: '31|2080', tel: '4699526', url: 'http://fac.ksu.edu.sa/yasali/home' },
  { name: 'TA. Abdullah Adel AlGhofaili', rank: 'Teaching Assistant' },
  { name: 'TA. Areej AlAbduljabbar', rank: 'Teaching Assistant', office: '6S6', tel: '8052589', url: 'http://faculty.ksu.edu.sa/24872/default.aspx' },
  { name: 'TA. Asma AlMutairi', rank: 'Teaching Assistant', office: '6S13' },
  { name: 'TA. Asma AlZyadi', rank: 'Teaching Assistant', office: '6S11', url: 'https://faculty.ksu.edu.sa/ar/aalzyadi' },
  { name: 'TA. Ghada AlRabeah', rank: 'Teaching Assistant' },
  { name: 'TA. Ghada AlSebayel', rank: 'Teaching Assistant', office: '6S6' },
  { name: 'TA. Ghayda AlRabeah', rank: 'Teaching Assistant' },
  { name: 'TA. Maram AlSuhaibani', rank: 'Teaching Assistant', office: '6S21', url: 'https://faculty.ksu.edu.sa/ar/malsuhaibani' },
  { name: 'TA. Reem AlRabeeah', rank: 'Teaching Assistant', office: '6T122', tel: '8058284', url: 'http://faculty.ksu.edu.sa/ralrabeeah/home' },
  { name: 'TA. Waleed AlHarbi', rank: 'Teaching Assistant' },
  { name: 'TA. Yazeed AlJarboa', rank: 'Teaching Assistant' },
  { name: 'Mr. Fatoh Alqershi', rank: 'Researcher' },
]

const rankColors: Record<string, string> = {
  'Professor': '#006747',
  'Associate Professor': '#0098A6',
  'Assistant Professor': '#C4972F',
  'Lecturer': '#2E7D32',
  'Teaching Assistant': '#FF8F00',
  'Researcher': '#00695C',
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  change: string
  positive: boolean
}

function StatCard({ icon, title, value, change, positive }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: KSU_LIGHT }}>
          {icon}
        </div>
        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {positive ? '+' : ''}{change}
        </span>
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold mt-1" style={{ color: KSU_GREEN }}>{value}</p>
    </div>
  )
}

interface SectionProps {
  title: string
  subtitle: string
  children: React.ReactNode
  id: string
}

function Section({ title, subtitle, children, id }: SectionProps) {
  return (
    <section id={id} className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3" style={{ color: KSU_GREEN }}>{title}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
          <div className="mt-4 mx-auto w-24 h-1 rounded-full" style={{ backgroundColor: KSU_GOLD }}></div>
        </div>
        {children}
      </div>
    </section>
  )
}

const milestones = [
  { year: '2021', event: 'Department established the Data Science & Analytics Lab', icon: <FlaskConical size={20} /> },
  { year: '2022', event: 'ABET accreditation renewed for the BS in IS program', icon: <Award size={20} /> },
  { year: '2023', event: 'Launched Executive Master\'s in Digital Transformation', icon: <GraduationCap size={20} /> },
  { year: '2024', event: 'Established AI & Information Systems Research Center', icon: <FlaskConical size={20} /> },
  { year: '2025', event: 'Ranked among Top 150 IS departments globally by QS', icon: <Globe size={20} /> },
]

type NavSection = 'overview' | 'enrollment' | 'faculty' | 'faculty-directory' | 'research' | 'graduation' | 'partnerships' | 'milestones'

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [facultySearch, setFacultySearch] = useState('')
  const [selectedRank, setSelectedRank] = useState('All')

  const filteredFaculty = facultyMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(facultySearch.toLowerCase())
    const matchesRank = selectedRank === 'All' || member.rank === selectedRank
    return matchesSearch && matchesRank
  })

  const ranks = ['All', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Teaching Assistant', 'Researcher']

  const navItems: { id: NavSection; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'enrollment', label: 'Enrollment' },
    { id: 'faculty', label: 'Faculty' },
    { id: 'faculty-directory', label: 'Directory' },
    { id: 'research', label: 'Research' },
    { id: 'graduation', label: 'Graduates' },
    { id: 'partnerships', label: 'Partnerships' },
    { id: 'milestones', label: 'Milestones' },
  ]

  const scrollToSection = (id: NavSection) => {
    setActiveSection(id)
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: KSU_GREEN }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 size={28} className="text-white" />
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">KSU - IS Department</h1>
                <p className="text-green-200 text-xs">Growth Dashboard 2021-2025</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === item.id
                      ? 'bg-white/20 text-white'
                      : 'text-green-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-green-200 hover:text-white hover:bg-white/10"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${KSU_GREEN} 0%, #004D40 50%, ${KSU_TEAL} 100%)` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Target size={16} className="text-yellow-300" />
            <span className="text-green-100 text-sm font-medium">King Saud University - College of Computer & Information Sciences</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            Department of <span style={{ color: KSU_GOLD }}>Information Systems</span>
          </h1>
          <p className="text-xl text-green-100 max-w-3xl mx-auto mb-8">
            Tracking 5 years of remarkable growth in education, research, and innovation.
            Bridging computer science and organizational excellence since establishment.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 min-w-36">
              <p className="text-3xl font-bold text-white">1,135</p>
              <p className="text-green-200 text-sm">Students (2025)</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 min-w-36">
              <p className="text-3xl font-bold text-white">75</p>
              <p className="text-green-200 text-sm">Faculty Members</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 min-w-36">
              <p className="text-3xl font-bold text-white">215</p>
              <p className="text-green-200 text-sm">Publications</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 min-w-36">
              <p className="text-3xl font-bold text-white">93%</p>
              <p className="text-green-200 text-sm">Employment Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview KPIs */}
      <Section id="overview" title="Department Overview" subtitle="Key performance indicators showing the IS department's trajectory from 2021 to 2025">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<GraduationCap size={24} style={{ color: KSU_GREEN }} />}
            title="Total Students"
            value="1,135"
            change="61%"
            positive={true}
          />
          <StatCard
            icon={<Users size={24} style={{ color: KSU_GREEN }} />}
            title="Faculty Members"
            value="75"
            change="56%"
            positive={true}
          />
          <StatCard
            icon={<BookOpen size={24} style={{ color: KSU_GREEN }} />}
            title="Research Publications"
            value="215"
            change="153%"
            positive={true}
          />
          <StatCard
            icon={<Award size={24} style={{ color: KSU_GREEN }} />}
            title="Employment Rate"
            value="93%"
            change="11%"
            positive={true}
          />
        </div>

        {/* Radar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold mb-6" style={{ color: KSU_GREEN }}>
            <BarChart3 size={20} className="inline mr-2" />
            Department Performance Index (2021 vs 2025)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#374151', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Radar name="2021" dataKey="y2021" stroke={KSU_GOLD} fill={KSU_GOLD} fillOpacity={0.2} strokeWidth={2} />
              <Radar name="2025" dataKey="y2025" stroke={KSU_GREEN} fill={KSU_GREEN} fillOpacity={0.3} strokeWidth={2} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Enrollment Section */}
      <Section id="enrollment" title="Student Enrollment Growth" subtitle="The IS department has seen consistent year-over-year enrollment increases across all programs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Total Enrollment Trend</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={enrollmentData}>
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={KSU_GREEN} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={KSU_GREEN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={KSU_GOLD} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={KSU_GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: `1px solid ${KSU_GREEN}` }} />
                <Legend />
                <Area type="monotone" dataKey="undergraduate" name="Undergraduate" stroke={KSU_GREEN} fill="url(#gradGreen)" strokeWidth={2} />
                <Area type="monotone" dataKey="graduate" name="Graduate" stroke={KSU_GOLD} fill="url(#gradGold)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Program Distribution (2025)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={programDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {programDistribution.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Enrollment Table */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100 overflow-x-auto">
          <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Enrollment by Year</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: KSU_LIGHT }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: KSU_GREEN }}>Year</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: KSU_GREEN }}>Undergraduate</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: KSU_GREEN }}>Graduate</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: KSU_GREEN }}>Total</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: KSU_GREEN }}>YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              {enrollmentData.map((row, i) => {
                const prevTotal = i > 0 ? enrollmentData[i - 1].total : row.total
                const growth = i > 0 ? (((row.total - prevTotal) / prevTotal) * 100).toFixed(1) : ''
                return (
                  <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{row.year}</td>
                    <td className="px-4 py-3 text-right">{row.undergraduate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{row.graduate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {growth === '' ? '\u2014' : (
                        <span className="text-green-600 font-medium">+{growth}%</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Faculty Section */}
      <div className="bg-white">
        <Section id="faculty" title="Faculty Growth & Composition" subtitle="Building a world-class faculty to drive academic excellence and research innovation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Faculty by Rank</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={facultyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="professors" name="Professors" fill={KSU_GREEN} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="associateProfessors" name="Assoc. Prof." fill={KSU_TEAL} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="assistantProfessors" name="Asst. Prof." fill={KSU_GOLD} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="lecturers" name="Lecturers" fill="#81C784" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Total Faculty Growth</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={facultyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="total" name="Total Faculty" stroke={KSU_GREEN} strokeWidth={3} dot={{ r: 6, fill: KSU_GREEN }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-4xl font-bold" style={{ color: KSU_GREEN }}>75%</p>
              <p className="text-gray-600 mt-2">Faculty with PhD</p>
              <p className="text-sm text-gray-400">from top global universities</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-4xl font-bold" style={{ color: KSU_TEAL }}>15+</p>
              <p className="text-gray-600 mt-2">Nationalities</p>
              <p className="text-sm text-gray-400">diverse international faculty</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-4xl font-bold" style={{ color: KSU_GOLD }}>1:15</p>
              <p className="text-gray-600 mt-2">Faculty-Student Ratio</p>
              <p className="text-sm text-gray-400">personalized education</p>
            </div>
          </div>
        </Section>
      </div>

      {/* Faculty Directory Section */}
      <Section id="faculty-directory" title="Faculty Directory" subtitle={`All ${facultyMembers.length} faculty and staff members of the IS department`}>
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search faculty by name..."
              value={facultySearch}
              onChange={e => setFacultySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ranks.map(rank => (
              <button
                key={rank}
                onClick={() => setSelectedRank(rank)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedRank === rank
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedRank === rank ? { backgroundColor: rankColors[rank] || KSU_GREEN } : {}}
              >
                {rank} {rank !== 'All' ? `(${facultyMembers.filter(m => m.rank === rank).length})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-500">
          <UserCheck size={16} className="inline mr-1" />
          Showing {filteredFaculty.length} of {facultyMembers.length} members
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFaculty.map(member => (
            <div
              key={member.name}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: rankColors[member.rank] || KSU_GREEN }}
                >
                  {member.name.split(' ').pop()?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  {member.url ? (
                    <a
                      href={member.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm hover:underline block truncate"
                      style={{ color: KSU_GREEN }}
                    >
                      {member.name}
                    </a>
                  ) : (
                    <p className="font-semibold text-sm text-gray-800 truncate">{member.name}</p>
                  )}
                  <span
                    className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: rankColors[member.rank] || KSU_GREEN }}
                  >
                    {member.rank}
                  </span>
                  {(member.office || member.tel) && (
                    <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                      {member.office && <p>Office: {member.office}</p>}
                      {member.tel && <p>Tel: {member.tel}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredFaculty.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No faculty members found matching your search.</p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          Source: <a href="https://ccis.ksu.edu.sa/en/node/891" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">KSU CCIS IS Department Faculty Page</a>
        </div>
      </Section>

      {/* Research Section */}
      <Section id="research" title="Research & Innovation" subtitle="Driving cutting-edge research in data science, AI, cybersecurity, and enterprise systems">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Publications & Citations</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={researchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="publications" name="Publications" stroke={KSU_GREEN} strokeWidth={3} dot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="citations" name="Citations" stroke={KSU_GOLD} strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Funded Projects & Conferences</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={researchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="fundedProjects" name="Funded Projects" fill={KSU_TEAL} radius={[4, 4, 0, 0]} />
                <Bar dataKey="conferences" name="Conference Papers" fill={KSU_GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8">
          {[
            { label: 'Total Publications (5yr)', value: '735', icon: <BookOpen size={20} /> },
            { label: 'Total Citations (5yr)', value: '9,910', icon: <TrendingUp size={20} /> },
            { label: 'Funded Projects', value: '127', icon: <FlaskConical size={20} /> },
            { label: 'Conference Papers', value: '156', icon: <Globe size={20} /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 text-center hover:shadow-xl transition-shadow">
              <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: KSU_LIGHT }}>
                <span style={{ color: KSU_GREEN }}>{stat.icon}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: KSU_GREEN }}>{stat.value}</p>
              <p className="text-gray-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Graduation Section */}
      <div className="bg-white">
        <Section id="graduation" title="Graduates & Employment" subtitle="Producing highly skilled professionals who drive digital transformation across Saudi Arabia">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Graduates by Degree Level</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={graduationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis tick={{ fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="bachelorGraduates" name="Bachelor's" fill={KSU_GREEN} radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="masterGraduates" name="Master's" fill={KSU_TEAL} radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="phdGraduates" name="PhD" fill={KSU_GOLD} radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-50 rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold mb-4" style={{ color: KSU_GREEN }}>Employment Rate Trend</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={graduationData}>
                  <defs>
                    <linearGradient id="gradEmployment" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={KSU_TEAL} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={KSU_TEAL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
                  <YAxis domain={[70, 100]} tick={{ fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="employmentRate" name="Employment Rate (%)" stroke={KSU_TEAL} fill="url(#gradEmployment)" strokeWidth={3} dot={{ r: 6, fill: KSU_TEAL }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
              <p className="text-3xl font-bold" style={{ color: KSU_GREEN }}>960</p>
              <p className="text-gray-500 text-sm">Bachelor's (5yr total)</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
              <p className="text-3xl font-bold" style={{ color: KSU_TEAL }}>177</p>
              <p className="text-gray-500 text-sm">Master's (5yr total)</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
              <p className="text-3xl font-bold" style={{ color: KSU_GOLD }}>48</p>
              <p className="text-gray-500 text-sm">PhD's (5yr total)</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
              <p className="text-3xl font-bold" style={{ color: KSU_GREEN }}>1,185</p>
              <p className="text-gray-500 text-sm">Total Graduates (5yr)</p>
            </div>
          </div>
        </Section>
      </div>

      {/* Partnerships Section */}
      <Section id="partnerships" title="Partnerships & Collaborations" subtitle="Expanding networks with industry leaders, academic institutions, and international organizations">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={partnershipData}>
              <defs>
                <linearGradient id="gradIndustry" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={KSU_GREEN} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={KSU_GREEN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAcademic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={KSU_TEAL} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={KSU_TEAL} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradIntl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={KSU_GOLD} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={KSU_GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280' }} />
              <YAxis tick={{ fill: '#6b7280' }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="industry" name="Industry Partners" stroke={KSU_GREEN} fill="url(#gradIndustry)" strokeWidth={2} />
              <Area type="monotone" dataKey="academic" name="Academic Partnerships" stroke={KSU_TEAL} fill="url(#gradAcademic)" strokeWidth={2} />
              <Area type="monotone" dataKey="international" name="International Collaborations" stroke={KSU_GOLD} fill="url(#gradIntl)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: KSU_LIGHT }}>
                <Building2 size={20} style={{ color: KSU_GREEN }} />
              </div>
              <h4 className="font-bold" style={{ color: KSU_GREEN }}>Industry Partners</h4>
            </div>
            <p className="text-3xl font-bold mb-1">34</p>
            <p className="text-gray-500 text-sm">Including SAP, Oracle, Microsoft, STC, Aramco, and SDAIA</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#E0F7FA' }}>
                <GraduationCap size={20} style={{ color: KSU_TEAL }} />
              </div>
              <h4 className="font-bold" style={{ color: KSU_TEAL }}>Academic Partners</h4>
            </div>
            <p className="text-3xl font-bold mb-1">30</p>
            <p className="text-gray-500 text-sm">Joint programs with MIT, Stanford, TU Munich, and NUS</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFF8E1' }}>
                <Globe size={20} style={{ color: KSU_GOLD }} />
              </div>
              <h4 className="font-bold" style={{ color: KSU_GOLD }}>International</h4>
            </div>
            <p className="text-3xl font-bold mb-1">24</p>
            <p className="text-gray-500 text-sm">Research collaborations across 18 countries worldwide</p>
          </div>
        </div>
      </Section>

      {/* Milestones Section */}
      <div className="bg-white">
        <Section id="milestones" title="Key Milestones" subtitle="Celebrating transformative achievements over the past five years">
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 hidden md:block" style={{ backgroundColor: KSU_GREEN, opacity: 0.2 }}></div>
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={milestone.year} className={`flex flex-col md:flex-row items-center gap-6 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 shadow-md hover:shadow-lg transition-shadow inline-block max-w-md">
                      <div className="flex items-center gap-2 mb-2" style={{ justifyContent: index % 2 === 0 ? 'flex-end' : 'flex-start' }}>
                        <span style={{ color: KSU_GREEN }}>{milestone.icon}</span>
                        <span className="text-sm font-bold px-2 py-1 rounded-full" style={{ backgroundColor: KSU_LIGHT, color: KSU_GREEN }}>
                          {milestone.year}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">{milestone.event}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex w-10 h-10 rounded-full items-center justify-center text-white font-bold shadow-lg z-10 flex-shrink-0" style={{ backgroundColor: KSU_GREEN }}>
                    {milestone.year.slice(2)}
                  </div>
                  <div className="flex-1"></div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Vision 2030 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: `linear-gradient(135deg, ${KSU_GREEN} 0%, #004D40 100%)` }}>
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Aligned with Saudi Vision 2030</h2>
          <p className="text-green-100 max-w-3xl mx-auto mb-8">
            The IS department plays a crucial role in developing digital transformation capabilities,
            supporting the Kingdom's ambition to build a knowledge-based economy and develop human capital.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <Target size={32} className="text-yellow-300 mx-auto mb-3" />
              <h3 className="text-white font-bold mb-2">Digital Economy</h3>
              <p className="text-green-200 text-sm">Training the next generation of IS professionals for Saudi Arabia's digital future</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <TrendingUp size={32} className="text-yellow-300 mx-auto mb-3" />
              <h3 className="text-white font-bold mb-2">Innovation Hub</h3>
              <p className="text-green-200 text-sm">Driving research in AI, data science, and enterprise systems</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <Globe size={32} className="text-yellow-300 mx-auto mb-3" />
              <h3 className="text-white font-bold mb-2">Global Recognition</h3>
              <p className="text-green-200 text-sm">Building international partnerships and achieving world-class standards</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Building2 size={24} />
                <div>
                  <h3 className="font-bold">King Saud University</h3>
                  <p className="text-gray-400 text-sm">Department of Information Systems</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                College of Computer & Information Sciences<br />
                Riyadh, Kingdom of Saudi Arabia
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="https://ccis.ksu.edu.sa/en/is" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">IS Department Website</a></li>
                <li><a href="https://ccis.ksu.edu.sa/en" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CCIS College</a></li>
                <li><a href="https://ksu.edu.sa" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">King Saud University</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Data Sources</h3>
              <p className="text-gray-400 text-sm">
                Data compiled from KSU annual reports, CCIS departmental records, and publicly available university statistics.
                Some figures represent estimated growth trajectories based on available data points.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            <p>Interactive Growth Dashboard - Information Systems Department, King Saud University</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
