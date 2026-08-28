import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiBookOpen, FiUpload, FiAward, FiClock, FiArrowRight } from 'react-icons/fi';

function Home() {
  const { user } = useSelector((state) => state.auth);

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-blue-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl font-extrabold mb-4">
            Ace Your Competitive Exams
          </h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Practice with curated test series for Banking, SSC, Railways, and more.
            Timed mock tests with detailed analytics to boost your preparation.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to={user ? '/dashboard' : '/register'}
              className="flex items-center gap-2 bg-white text-primary-700 px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-gray-100 transition"
            >
              {user ? 'Go to Dashboard' : 'Get Started Free'}
              <FiArrowRight />
            </Link>
            {!user && (
              <Link
                to="/login"
                className="flex items-center gap-2 border-2 border-white/40 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-white/10 transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose TestSeriesPro?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiBookOpen className="text-2xl text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Comprehensive Tests</h3>
              <p className="text-gray-500 text-sm">
                Thousands of questions covering all topics for banking, SSC, railways, and more.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiClock className="text-2xl text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Timed Mock Tests</h3>
              <p className="text-gray-500 text-sm">
                Real exam-like environment with timers, question navigation, and mark-for-review.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiAward className="text-2xl text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Detailed Analysis</h3>
              <p className="text-gray-500 text-sm">
                Section-wise analysis, score tracking, and detailed solutions for every question.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiUpload className="text-2xl text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Bulk Upload</h3>
              <p className="text-gray-500 text-sm">
                Admins can add 100+ questions at once via Excel/CSV upload with validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Start Your Preparation?
          </h2>
          <p className="text-gray-500 mb-8">
            Join thousands of students preparing for competitive exams with our platform.
          </p>
          <Link
            to={user ? '/dashboard' : '/register'}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-primary-700 transition"
          >
            {user ? 'Browse Test Series' : 'Create Free Account'}
            <FiArrowRight />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>TestSeriesPro - Online Test Preparation Platform</p>
          <p className="mt-1">Built with MERN Stack (MongoDB, Express, React, Node.js)</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
