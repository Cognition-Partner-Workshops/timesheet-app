import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'عن الجامعة', href: 'https://ksu.edu.sa/ar' },
  { label: 'البحث العلمي', href: 'https://ksu.edu.sa/ar' },
  { label: 'الدراسة بالجامعة', href: 'https://ksu.edu.sa/ar' },
  { label: 'الحياة بالجامعة', href: 'https://ksu.edu.sa/ar' },
  { label: 'الخدمات الإلكترونية', href: 'https://ksu.edu.sa/ar' },
  { label: 'المركز الإعلامي', href: 'https://ksu.edu.sa/ar' },
  { label: 'اللوائح والأنظمة', href: '/regulations', isInternal: true, isNew: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="w-full sticky top-0 z-50">
      {/* Top government bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-8 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <img src="https://ksu.edu.sa/saudi-flag.svg" alt="علم المملكة" className="h-4" />
            <span>موقع حكومي رسمي تابع لحكومة المملكة العربية السعودية</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">نسخة تجريبية</span>
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img
              src="https://ksu.edu.sa/_next/image?url=%2Fksu_logo.png&w=384&q=75"
              alt="جامعة الملك سعود"
              className="h-14"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.isInternal && location.pathname === item.href;
              if (item.isInternal) {
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className={`relative px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'text-white bg-ksu-green'
                        : 'text-gray-700 hover:text-ksu-green hover:bg-green-50'
                    }`}
                  >
                    {item.label}
                    {item.isNew && (
                      <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] px-1 rounded-full leading-tight">
                        جديد
                      </span>
                    )}
                  </Link>
                );
              }
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-ksu-green hover:bg-green-50 rounded-md transition-colors"
                >
                  {item.label}
                  <svg className="inline-block w-3 h-3 mr-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </a>
              );
            })}
          </nav>

          {/* Search + Language */}
          <div className="hidden lg:flex items-center gap-3">
            <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-ksu-green">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              البحث
            </button>
            <span className="text-sm text-gray-400">|</span>
            <button className="text-sm text-gray-600 hover:text-ksu-green">English</button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              if (item.isInternal) {
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-ksu-green rounded-md"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                    {item.isNew && (
                      <span className="mr-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">جديد</span>
                    )}
                  </Link>
                );
              }
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-ksu-green rounded-md"
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
