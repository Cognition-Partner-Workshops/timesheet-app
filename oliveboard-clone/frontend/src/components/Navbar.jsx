import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../redux/authSlice';
import { FiBookOpen, FiLogOut, FiUser, FiSettings } from 'react-icons/fi';

function Navbar() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <FiBookOpen className="text-2xl text-primary-600" />
            <span className="text-xl font-bold text-gray-900">
              TestSeries<span className="text-primary-600">Pro</span>
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-primary-600 font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/my-attempts"
                  className="text-gray-600 hover:text-primary-600 font-medium"
                >
                  My Attempts
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="flex items-center space-x-1 text-gray-600 hover:text-primary-600 font-medium"
                  >
                    <FiSettings className="text-sm" />
                    <span>Admin</span>
                  </Link>
                )}
                <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                  <FiUser className="text-gray-500" />
                  <span className="text-sm text-gray-700 font-medium">
                    {user.name}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-red-500 hover:text-red-700 ml-2"
                  >
                    <FiLogOut />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-primary-600 font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
