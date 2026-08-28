import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { regulations, categories } from '../data/regulations';

export default function RegulationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filtered = useMemo(() => {
    let result = [...regulations];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'الكل') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    result.sort((a, b) => {
      if (sortOrder === 'newest') return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });

    return result;
  }, [searchQuery, selectedCategory, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-ksu-green transition-colors">الرئيسية</Link>
            <svg className="w-3 h-3 rotate-180 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-ksu-green font-medium">اللوائح والأنظمة</span>
          </nav>
        </div>
      </div>

      {/* Page Title */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">اللوائح والأنظمة</h1>
          <p className="text-gray-500 mt-2 text-base">جميع اللوائح والأنظمة والوثائق الرسمية لجامعة الملك سعود</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters - styled like HRSD */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن كلمة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ksu-green focus:border-transparent placeholder-gray-400"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">القطاع</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ksu-green focus:border-transparent bg-white appearance-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === 'الكل' ? '- اختر -' : cat}</option>
                ))}
              </select>
            </div>

            {/* Tags filter (visual only, matching HRSD layout) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المستفيدين</label>
              <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ksu-green focus:border-transparent bg-white appearance-none cursor-pointer">
                <option>- اختر -</option>
                <option>أعضاء هيئة التدريس</option>
                <option>الطلاب</option>
                <option>الموظفين</option>
                <option>الباحثين</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الترتيب حسب</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ksu-green focus:border-transparent bg-white appearance-none cursor-pointer"
              >
                <option value="newest">الأحدث</option>
                <option value="oldest">الأقدم</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-500">
          عرض {filtered.length} من {regulations.length} نتيجة
        </div>

        {/* Results Grid - styled like HRSD cards */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-lg">لا توجد نتائج مطابقة لبحثك</p>
            <p className="text-gray-400 text-sm mt-1">حاول تعديل معايير البحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((reg) => (
              <div
                key={reg.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-ksu-green/30 transition-all group flex flex-col"
              >
                {/* Title */}
                <h3 className="text-base font-bold text-gray-900 mb-3 leading-relaxed group-hover:text-ksu-green transition-colors line-clamp-2">
                  {reg.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-500 mb-4 leading-relaxed line-clamp-3 flex-grow">
                  {reg.description}
                </p>

                {/* Date */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{reg.date} هـ</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {reg.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block bg-ksu-green/10 text-ksu-green text-xs px-2.5 py-1 rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">
                    {reg.category}
                  </span>
                </div>

                {/* Read more arrow - like HRSD */}
                <div className="flex items-center justify-start pt-3 border-t border-gray-100">
                  <button className="flex items-center gap-2 text-ksu-green text-sm font-semibold hover:gap-3 transition-all">
                    <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination - visual like HRSD */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-ksu-green hover:text-ksu-green transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="w-9 h-9 rounded-lg bg-ksu-green text-white flex items-center justify-center text-sm font-bold">1</button>
            <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-sm text-gray-600 hover:border-ksu-green hover:text-ksu-green transition-colors">2</button>
            <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-ksu-green hover:text-ksu-green transition-colors">
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
