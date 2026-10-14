import { Link } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span className="navbar-icon">&#x1F4C8;</span>
          <span className="navbar-title">StockPulse</span>
        </Link>
        <div className="navbar-actions">
          <SearchBar />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
