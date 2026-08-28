import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-ksu-dark text-white">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Social */}
          <div>
            <h3 className="text-lg font-bold mb-4">تابعنا على</h3>
            <div className="flex gap-3">
              {[
                { name: 'Facebook', url: 'https://www.facebook.com/King.Saud.University', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
                { name: 'Twitter', url: 'https://x.com/_KSU', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                { name: 'YouTube', url: 'https://www.youtube.com/user/pdksuchannel', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
                { name: 'LinkedIn', url: 'https://www.linkedin.com/school/king-saud-university', icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  aria-label={social.name}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold mb-4">تواصل معنا</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="https://ksu.edu.sa/contact-us" className="hover:text-white transition-colors">اتصل بنا</a></li>
              <li><a href="https://ksu.edu.sa/campus-location" className="hover:text-white transition-colors">موقع الجامعة</a></li>
              <li><a href="https://dfpa.ksu.edu.sa/ar/jobs" className="hover:text-white transition-colors">التوظيف</a></li>
              <li><a href="https://ksu.edu.sa/reporting" className="hover:text-white transition-colors">البلاغات</a></li>
            </ul>
          </div>

          {/* Apps */}
          <div>
            <h3 className="text-lg font-bold mb-4">تطبيقات الجامعة</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="https://ksu.edu.sa/staff-e-services" className="hover:text-white transition-colors">الخدمات الإلكترونية للمنسوبين</a></li>
              <li><a href="https://ksu.edu.sa/students-e-services" className="hover:text-white transition-colors">الخدمات الإلكترونية للطلاب</a></li>
              <li><a href="https://ksu.edu.sa/ayat-app" className="hover:text-white transition-colors">تطبيق آيات</a></li>
            </ul>
          </div>

          {/* Important Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">روابط مهمة</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link to="/regulations" className="hover:text-white transition-colors">اللوائح والأنظمة</Link></li>
              <li><a href="https://ksu.edu.sa/policies" className="hover:text-white transition-colors">السياسات والأنظمة</a></li>
              <li><a href="https://sustainability.ksu.edu.sa/" className="hover:text-white transition-colors">الاستدامة</a></li>
              <li><a href="https://data.ksu.edu.sa/ar" className="hover:text-white transition-colors">البيانات المفتوحة</a></li>
              <li><a href="https://ksu.edu.sa/annual-reports" className="hover:text-white transition-colors">التقارير السنوية</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="https://ksu.edu.sa/_next/image?url=%2Fksu_logo.png&w=384&q=75"
              alt="جامعة الملك سعود"
              className="h-10 brightness-0 invert"
            />
            <a href="https://www.vision2030.gov.sa/ar" target="_blank" rel="noopener noreferrer">
              <img
                src="https://ksu.edu.sa/vision2030.svg"
                alt="رؤية 2030"
                className="h-8 brightness-0 invert"
              />
            </a>
          </div>
          <p className="text-xs text-gray-400">جميع الحقوق محفوظة لجامعة الملك سعود © 2026</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="https://ksu.edu.sa/privacy" className="hover:text-white">سياسة الخصوصية</a>
            <a href="https://ksu.edu.sa/terms" className="hover:text-white">شروط الاستخدام</a>
            <a href="https://ksu.edu.sa/sitemap" className="hover:text-white">خريطة الموقع</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
