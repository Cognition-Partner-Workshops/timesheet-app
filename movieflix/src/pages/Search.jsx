import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { searchMovies, discoverMovies } from "../services/tmdb";
import { useGenres } from "../context/GenreContext";
import MovieGrid from "../components/MovieGrid";
import { FiSearch } from "react-icons/fi";
import "./Search.css";

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);
const RATINGS = [
  { label: "All Ratings", min: 0, max: 10 },
  { label: "9+ Exceptional", min: 9, max: 10 },
  { label: "8+ Great", min: 8, max: 10 },
  { label: "7+ Good", min: 7, max: 10 },
  { label: "6+ Decent", min: 6, max: 10 },
  { label: "5+ Average", min: 5, max: 10 },
];
const SORT_OPTIONS = [
  { label: "Popularity", value: "popularity.desc" },
  { label: "Rating (High-Low)", value: "vote_average.desc" },
  { label: "Rating (Low-High)", value: "vote_average.asc" },
  { label: "Release Date (New)", value: "primary_release_date.desc" },
  { label: "Release Date (Old)", value: "primary_release_date.asc" },
  { label: "Title (A-Z)", value: "original_title.asc" },
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { genres } = useGenres();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get("genre") || "");
  const [selectedYear, setSelectedYear] = useState(searchParams.get("year") || "");
  const [selectedRating, setSelectedRating] = useState(searchParams.get("rating") || "0");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "popularity.desc");

  const initialLoad = useRef(true);

  const performSearch = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      try {
        let res;
        if (query.trim()) {
          res = await searchMovies(query.trim(), pageNum);
        } else {
          const params = { page: pageNum, sort_by: sortBy };
          if (selectedGenre) params.with_genres = selectedGenre;
          if (selectedYear) {
            params.primary_release_year = selectedYear;
          }
          const rating = RATINGS[Number(selectedRating)] || RATINGS[0];
          if (rating.min > 0) {
            params["vote_average.gte"] = rating.min;
            params["vote_count.gte"] = 50;
          }
          res = await discoverMovies(params);
        }

        let results = res.data.results;
        if (query.trim() && Number(selectedRating) > 0) {
          const rating = RATINGS[Number(selectedRating)];
          results = results.filter(
            (m) => m.vote_average >= rating.min && m.vote_average <= rating.max
          );
        }
        if (query.trim() && selectedGenre) {
          const gid = Number(selectedGenre);
          results = results.filter((m) => m.genre_ids?.includes(gid));
        }
        if (query.trim() && selectedYear) {
          results = results.filter(
            (m) => m.release_date?.startsWith(selectedYear)
          );
        }

        setMovies(pageNum === 1 ? results : (prev) => [...prev, ...results]);
        setTotalPages(res.data.total_pages);
        setPage(pageNum);
      } catch {
        setMovies([]);
      }
      setLoading(false);
    },
    [query, selectedGenre, selectedYear, selectedRating, sortBy]
  );

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      performSearch(1);
    }
  }, [performSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = {};
    if (query) params.q = query;
    if (selectedGenre) params.genre = selectedGenre;
    if (selectedYear) params.year = selectedYear;
    if (selectedRating !== "0") params.rating = selectedRating;
    if (sortBy !== "popularity.desc") params.sort = sortBy;
    setSearchParams(params);
    performSearch(1);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedGenre("");
    setSelectedYear("");
    setSelectedRating("0");
    setSortBy("popularity.desc");
    setSearchParams({});
    performSearch(1);
  };

  return (
    <div className="search-page">
      <div className="search-page__header">
        <h1>Search Movies</h1>
      </div>

      <form className="search-page__form" onSubmit={handleSubmit}>
        <div className="search-page__input-row">
          <div className="search-page__input-wrapper">
            <FiSearch className="search-page__input-icon" />
            <input
              type="text"
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-page__input"
            />
          </div>
          <button type="submit" className="search-page__btn">
            Search
          </button>
        </div>

        <div className="search-page__filters">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="search-page__select"
          >
            <option value="">All Genres</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="search-page__select"
          >
            <option value="">All Years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            className="search-page__select"
          >
            {RATINGS.map((r, i) => (
              <option key={i} value={i}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="search-page__select"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="search-page__clear"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </form>

      {loading && movies.length === 0 ? (
        <div className="search-page__loading">Loading...</div>
      ) : (
        <>
          <MovieGrid
            movies={movies}
            title={query ? `Results for "${query}"` : "Discover Movies"}
          />
          {page < totalPages && (
            <div className="search-page__loadmore">
              <button
                className="search-page__btn"
                onClick={() => performSearch(page + 1)}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
