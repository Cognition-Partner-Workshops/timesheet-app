import { useState } from 'react'
import './App.css'
import { Search, ExternalLink, Calendar, User, Newspaper, GraduationCap, Beaker, Award, Globe, Filter } from 'lucide-react'

type NewsSource = 'all' | 'ksu' | 'arabnews' | 'saudigazette'
type NewsCategory = 'all' | 'academics' | 'research' | 'achievements' | 'events' | 'general'

interface NewsArticle {
  id: number
  title: string
  summary: string
  date: string
  source: NewsSource
  sourceName: string
  sourceUrl: string
  category: NewsCategory
  categoryLabel: string
  journalist: string
  imageUrl: string
  articleUrl: string
}

const newsArticles: NewsArticle[] = [
  {
    id: 1,
    title: "King Saud University launches Executive Master's program in Digital Transformation",
    summary: "King Saud University launches the Executive Master's Program in Digital Transformation, a unique program offered through an integrated academic partnership between the College of Computer and Information Sciences and the College of Business Administration.",
    date: "16 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'academics',
    categoryLabel: "Academics",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146102"
  },
  {
    id: 2,
    title: "Opportunities and Challenges in Artificial Intelligence Research in Dentistry",
    summary: "The College of Computer and Information Sciences, in collaboration with the College of Dentistry and the Saudi Dental Society, held a dialogue session exploring AI opportunities and challenges in dental research.",
    date: "16 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'research',
    categoryLabel: "Research",
    journalist: "KSU Research Unit",
    imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146101"
  },
  {
    id: 3,
    title: "Students win at 13th International Conference on Mobility, IoT and Smart Cities",
    summary: "Students Ruba Al-Banhar, Rima Al-Sharif, Raghad Al-Buqami, and Taif Al-Rabeean, under the supervision of Dr. Amira Al-Masoud, received the Best Paper Award at the 13th International Conference (EAI) held in Dubai.",
    date: "16 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'achievements',
    categoryLabel: "Achievements",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146099"
  },
  {
    id: 4,
    title: "Dr. Majdal Bin Safrane recognized by Wiley for most cited research",
    summary: "Dr. Majdal Bin Safran received recognition from the international publishing house Wiley after his research, published in the Journal of Sensors, was ranked among the most cited articles for 2024-2025.",
    date: "16 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'research',
    categoryLabel: "Research",
    journalist: "KSU Research Unit",
    imageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146098"
  },
  {
    id: 5,
    title: "College of Medicine enhances female students' empowerment in sports",
    summary: "Medical college female students recorded a notable presence in the university sports scene through their participation in diverse tournaments organized by the college's women's sports club, reflecting the growing culture of women's sports.",
    date: "20 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'events',
    categoryLabel: "Events",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1461896836934-bd45ba7b5491?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146112"
  },
  {
    id: 6,
    title: "Obesity Research Center discovers protein differences in cancer study",
    summary: "A scientific study by the University Obesity Research Center, in collaboration with the Department of Obstetrics and Gynecology, revealed fundamental differences in the protein composition of endometrial cancer associated with obesity.",
    date: "15 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'research',
    categoryLabel: "Research",
    journalist: "Nayef Al Fahid",
    imageUrl: "https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146091"
  },
  {
    id: 7,
    title: "College of Medicine launches Qur'an Memorization Competition 'The Memorizing Physician'",
    summary: "The College of Medicine, represented by the Medical Club, launched the Dean's Competition for the Memorization of the Holy Qur'an with the participation of more than 120 male and female students.",
    date: "15 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'events',
    categoryLabel: "Events",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1585036156171-384164a8c159?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146089"
  },
  {
    id: 8,
    title: "Dean inaugurates closing exhibition of National Scoliosis Awareness Campaign",
    summary: "The Dean of the College of Medicine inaugurated the closing exhibition of the National Campaign for Awareness of Spinal Deformities (Scoliosis 15), led by medical students and physicians in the Department of Orthopedic Surgery.",
    date: "12 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'events',
    categoryLabel: "Events",
    journalist: "Yasser Al-Khudairi",
    imageUrl: "https://images.unsplash.com/photo-1551076805-e1869033e561?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146087"
  },
  {
    id: 9,
    title: "Dr. Soha Kaaki leads establishment of Saudi Society for Robotic Surgery",
    summary: "Dr. Soha Kaaki, Assistant Professor in the Department of Surgery at the College of Medicine, announced the establishment of the Saudi Society for Robotic Surgery, reflecting leadership in adopting advanced medical technologies.",
    date: "5 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'achievements',
    categoryLabel: "Achievements",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146054"
  },
  {
    id: 10,
    title: "Qabas AI project by female students selected by SenseTime MEA",
    summary: "The 'Qabas' project by students Ghaida Al-Hussain, Deem Al-Jarba, Sarah Al-Huwaimeel, and Reema Al-Kridis was selected as part of the Artificial Intelligence Innovation Initiative and strategic partnership with King Saud University.",
    date: "6 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'achievements',
    categoryLabel: "Achievements",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146059"
  },
  {
    id: 11,
    title: "Faculty member receives US Patent for lightweight network authentication",
    summary: "Dr. Abdulrahman bin Rabia was awarded a patent from the United States Patent and Trademark Office (USPTO) for his invention entitled 'Lightweight Network Authentication for Resource-Constrained Devices via Mergeable Stateful Hash-based Signatures.'",
    date: "6 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'achievements',
    categoryLabel: "Achievements",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146058"
  },
  {
    id: 12,
    title: "20 startups launched through university accelerator program",
    summary: "Some 20 startups launched into the Saudi market at the conclusion of the University Startup Accelerator Program, organized by Monshaat, the General Authority for Small and Medium Enterprises.",
    date: "20 April 2026",
    source: 'arabnews',
    sourceName: "Arab News",
    sourceUrl: "https://www.arabnews.com",
    category: 'general',
    categoryLabel: "General",
    journalist: "Arab News Staff",
    imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&q=80",
    articleUrl: "https://www.arabnews.com/node/2640603/business-economy"
  },
  {
    id: 13,
    title: "Strategic plan to boost crime research and analytics in Saudi Arabia",
    summary: "Saudi Arabia's Minister of Interior approved a new strategic plan for the Crime Research Center, prepared with the help of experts in criminal research and analysis.",
    date: "20 April 2026",
    source: 'arabnews',
    sourceName: "Arab News",
    sourceUrl: "https://www.arabnews.com",
    category: 'research',
    categoryLabel: "Research",
    journalist: "Arab News Riyadh Bureau",
    imageUrl: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&q=80",
    articleUrl: "https://www.arabnews.com/node/2640619/saudi-arabia"
  },
  {
    id: 14,
    title: "Eastern Province to host $267m private sector sports project",
    summary: "Saudi Arabia's Eastern Province is preparing to welcome a SR1 billion ($267 million) private sector-driven sports development project after a major agreement at the Sports Investment Forum in Riyadh.",
    date: "20 April 2026",
    source: 'arabnews',
    sourceName: "Arab News",
    sourceUrl: "https://www.arabnews.com",
    category: 'general',
    categoryLabel: "General",
    journalist: "Arab News Staff",
    imageUrl: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80",
    articleUrl: "https://www.arabnews.com/node/2640578/business-economy"
  },
  {
    id: 15,
    title: "College of Medicine Business Unit enhances project efficiency through workshop",
    summary: "The Business Unit at the College of Medicine organized a specialized workshop titled 'Tender Document Analysis and Preparation of Technical and Financial Proposals' to enhance institutional capabilities.",
    date: "8 April 2026",
    source: 'ksu',
    sourceName: "KSU Official News",
    sourceUrl: "https://news.ksu.edu.sa/en",
    category: 'events',
    categoryLabel: "Events",
    journalist: "KSU Communications",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=80",
    articleUrl: "https://news.ksu.edu.sa/en/node/146075"
  },
  {
    id: 16,
    title: "Saudi liquidity surges 8.4% to SR3.28 trillion by end of February",
    summary: "Saudi Arabia's broad money supply (M3) grew by 8.4% year-on-year reaching SR3.28 trillion by the end of February 2026, reflecting strong economic momentum.",
    date: "21 April 2026",
    source: 'saudigazette',
    sourceName: "Saudi Gazette",
    sourceUrl: "https://saudigazette.com.sa",
    category: 'general',
    categoryLabel: "General",
    journalist: "Saudi Gazette Staff",
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80",
    articleUrl: "https://saudigazette.com.sa/article/660708"
  },
  {
    id: 17,
    title: "NCM forecast: Riyadh to witness heavy rainfall on Thursday and Friday",
    summary: "The National Center for Meteorology forecasts heavy rainfall expected to hit Riyadh and surrounding areas on Thursday and Friday this week.",
    date: "21 April 2026",
    source: 'saudigazette',
    sourceName: "Saudi Gazette",
    sourceUrl: "https://saudigazette.com.sa",
    category: 'general',
    categoryLabel: "General",
    journalist: "Saudi Gazette Staff",
    imageUrl: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600&q=80",
    articleUrl: "https://saudigazette.com.sa/article/660709"
  },
  {
    id: 18,
    title: "Makkah airport and metro plans underway",
    summary: "Plans to build an airport and a metro system in Makkah are underway as the city moves ahead with major transport and infrastructure upgrades.",
    date: "1 April 2026",
    source: 'saudigazette',
    sourceName: "Saudi Gazette",
    sourceUrl: "https://saudigazette.com.sa",
    category: 'general',
    categoryLabel: "General",
    journalist: "Saudi Gazette Staff",
    imageUrl: "https://images.unsplash.com/photo-1586724237569-9c5cbe5ebf9a?w=600&q=80",
    articleUrl: "https://saudigazette.com.sa/article/660176"
  }
]

const sourceColors: Record<NewsSource, string> = {
  all: '',
  ksu: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  arabnews: 'bg-amber-100 text-amber-800 border-amber-200',
  saudigazette: 'bg-blue-100 text-blue-800 border-blue-200',
}

const categoryIcons: Record<NewsCategory, typeof Newspaper> = {
  all: Newspaper,
  academics: GraduationCap,
  research: Beaker,
  achievements: Award,
  events: Calendar,
  general: Globe,
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<NewsSource>('all')
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>('all')

  const filteredArticles = newsArticles.filter((article) => {
    const matchesSearch =
      searchQuery === '' ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.journalist.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSource = selectedSource === 'all' || article.source === selectedSource
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory
    return matchesSearch && matchesSource && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-emerald-800 font-bold text-lg">KSU</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  King Saud University
                </h1>
                <p className="text-emerald-200 text-sm sm:text-base">
                  News Aggregator Portal
                </p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a href="https://ksu.edu.sa" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-200 transition-colors flex items-center gap-1">
                KSU Main <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://news.ksu.edu.sa/en" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-200 transition-colors flex items-center gap-1">
                Official News <ExternalLink className="w-3 h-3" />
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative bg-emerald-900 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1584183812211-6739606c59e6?w=1400&q=80')`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 drop-shadow-lg">
              Latest News & Updates
            </h2>
            <p className="text-lg sm:text-xl text-emerald-100 max-w-3xl mx-auto mb-8">
              Stay informed with the latest developments from King Saud University
              and leading Saudi news outlets &mdash; all in one place.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white border border-white/30">
                <Newspaper className="w-4 h-4 inline mr-2" />
                KSU Official News
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white border border-white/30">
                <Globe className="w-4 h-4 inline mr-2" />
                Arab News
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white border border-white/30">
                <Globe className="w-4 h-4 inline mr-2" />
                Saudi Gazette
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search news by title, summary, or journalist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-50 transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Source Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Source:</span>
              {([
                ['all', 'All Sources'],
                ['ksu', 'KSU Official'],
                ['arabnews', 'Arab News'],
                ['saudigazette', 'Saudi Gazette'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSelectedSource(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedSource === value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Category:</span>
              {([
                ['all', 'All'],
                ['academics', 'Academics'],
                ['research', 'Research'],
                ['achievements', 'Achievements'],
                ['events', 'Events'],
                ['general', 'General'],
              ] as const).map(([value, label]) => {
                const Icon = categoryIcons[value]
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedCategory(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                      selectedCategory === value
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-700">{filteredArticles.length}</span> article{filteredArticles.length !== 1 ? 's' : ''}
          {searchQuery && (
            <span>
              {' '}for &ldquo;<span className="font-medium text-emerald-700">{searchQuery}</span>&rdquo;
            </span>
          )}
        </p>
      </div>

      {/* Featured Article */}
      {filteredArticles.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <a
            href={filteredArticles[0].articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow bg-white">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/2">
                  <img
                    src={filteredArticles[0].imageUrl}
                    alt={filteredArticles[0].title}
                    className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'https://placehold.co/600x400/047857/ffffff/png?text=KSU+News'
                    }}
                  />
                </div>
                <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${sourceColors[filteredArticles[0].source]}`}>
                      {filteredArticles[0].sourceName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      {filteredArticles[0].categoryLabel}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 group-hover:text-emerald-700 transition-colors">
                    {filteredArticles[0].title}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {filteredArticles[0].summary}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {filteredArticles[0].date}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {filteredArticles[0].journalist}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
      )}

      {/* News Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {filteredArticles.length > 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.slice(1).map((article) => {
              const CategoryIcon = categoryIcons[article.category]
              return (
                <a
                  key={article.id}
                  href={article.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'https://placehold.co/600x400/047857/ffffff/png?text=KSU+News'
                      }}
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm ${sourceColors[article.source]}`}>
                        {article.sourceName}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-gray-700 flex items-center gap-1">
                        <CategoryIcon className="w-3 h-3" />
                        {article.categoryLabel}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {article.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {article.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {article.journalist}
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No articles found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="bg-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <span className="text-emerald-800 font-bold text-sm">KSU</span>
                </div>
                <div>
                  <h4 className="font-bold">King Saud University</h4>
                  <p className="text-emerald-300 text-sm">News Portal</p>
                </div>
              </div>
              <p className="text-emerald-200 text-sm leading-relaxed">
                Aggregating the latest news and updates from King Saud University
                and leading Saudi Arabian news sources.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">News Sources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://news.ksu.edu.sa/en" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> KSU Official News
                  </a>
                </li>
                <li>
                  <a href="https://www.arabnews.com" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Arab News
                  </a>
                </li>
                <li>
                  <a href="https://saudigazette.com.sa" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Saudi Gazette
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://ksu.edu.sa" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> KSU Main Website
                  </a>
                </li>
                <li>
                  <a href="https://ksu.edu.sa/en/Colleges" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Colleges
                  </a>
                </li>
                <li>
                  <a href="https://ksu.edu.sa/en/ResearchCenters" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-white transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Research Centers
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-emerald-800 text-center text-sm text-emerald-300">
            <p>King Saud University &mdash; Riyadh, Kingdom of Saudi Arabia</p>
            <p className="mt-1">News aggregated from multiple public sources for informational purposes.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
