import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-ksu-green text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)'
          }} />
        </div>
        <div className="max-w-7xl mx-auto px-4 py-24 md:py-36 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">جامعة الملك سعود</h1>
          <p className="text-lg md:text-xl text-white/80 mb-8">الريادة العالمية والتميز في بناء مجتمع المعرفة</p>
          <a
            href="https://ksu.edu.sa/strategy-and-values"
            className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-white hover:text-ksu-green transition-colors"
          >
            المزيد
          </a>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">الجامعة في أرقام</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { number: '17.4', label: 'أبرز تصنيفات الجامعة لهذا العام', icon: '🏆' },
              { number: '0.3', label: 'أبرز انجازات الجامعة لهذا العام', icon: '⭐' },
              { number: '1', label: 'المركز الأول في علم الأورام وطب القلب', icon: '🏥' },
              { number: '3%', label: 'من إجمالي أبحاث المملكة العربية السعودية', icon: '🔬' },
            ].map((stat, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="text-3xl mb-3">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-extrabold text-ksu-green mb-2">{stat.number}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulations CTA Section */}
      <section className="py-16 bg-gradient-to-l from-ksu-green to-ksu-dark text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">اللوائح والأنظمة</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            تصفح جميع اللوائح والأنظمة الرسمية لجامعة الملك سعود بما في ذلك اللوائح الأكاديمية والإدارية والمالية وأنظمة شؤون الطلاب والبحث العلمي
          </p>
          <Link
            to="/regulations"
            className="inline-block bg-white text-ksu-green px-8 py-3 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors"
          >
            تصفح اللوائح والأنظمة
          </Link>
        </div>
      </section>

      {/* News Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold text-gray-800">آخر الأخبار</h2>
            <a
              href="https://ksu.edu.sa/news"
              className="text-ksu-green text-sm font-semibold hover:underline flex items-center gap-1"
            >
              المزيد
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'معرض اليوم العالمي للإبداع والابتكار',
                date: '19/04/2026',
                desc: 'تدعوكم جامعة الملك سعود ممثلةً في مركز الابتكار بمعهد ريادة الأعمال لحضور معرض اليوم العالمي للإبداع والابتكار.',
              },
              {
                title: 'كلية طب الاسنان تحقق العديد من الإنجازات',
                date: '15/04/2026',
                desc: 'حققت جامعة الملك سعود ممثلةً في كلية طب الأسنان، إنجازًا مميزًا بحصول فريق الكلية على المركز الثالث في هاكاثون ابتكار النظم الصحية.',
              },
              {
                title: 'المؤتمر الدولي العاشر للجمعية السعودية للإعلام',
                date: '08/04/2026',
                desc: 'أنطلقت أعمال المؤتمر الدولي العاشر للجمعية السعودية للإعلام والاتصال، تحت شعار "إعلام الذكاء الاصطناعي.. الفرص والتحديات".',
              },
            ].map((news, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="h-48 bg-gradient-to-bl from-ksu-green/20 to-ksu-green/5 flex items-center justify-center">
                  <svg className="w-16 h-16 text-ksu-green/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <div className="p-5">
                  <p className="text-xs text-gray-400 mb-2">تاريخ آخر تعديل: {news.date}</p>
                  <h3 className="text-base font-bold text-gray-800 mb-2 group-hover:text-ksu-green transition-colors leading-relaxed">
                    {news.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">{news.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
