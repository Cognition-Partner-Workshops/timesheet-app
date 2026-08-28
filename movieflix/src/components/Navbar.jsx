import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import "./Navbar.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSearch(false);
    }
  };

  return (
    <nav className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="navbar__left">
        <Link to="/" className="navbar__logo">
          MOVIEFLIX
        </Link>
        <Link to="/" className="navbar__link">Home</Link>
        <Link to="/search" className="navbar__link">Search</Link>
        <Link to="/genre" className="navbar__link">Genres</Link>
      </div>

      <div className="navbar__right">
        <div className={`navbar__search ${showSearch ? "navbar__search--open" : ""}`}>
          <button
            className="navbar__search-btn"
            onClick={() => setShowSearch(!showSearch)}
            aria-label="Toggle search"
          >
            <FiSearch />
          </button>
          {showSearch && (
            <form onSubmit={handleSearch} className="navbar__search-form">
              <input
                type="text"
                placeholder="Titles, genres, people..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </form>
          )}
        </div>
      </div>
    </nav>
  );
}
