import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useGenres } from "../context/GenreContext";
import { fetchByGenre } from "../services/tmdb";
import MovieGrid from "../components/MovieGrid";
import "./Genre.css";

export default function Genre() {
  const { genres } = useGenres();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const activeGenre = searchParams.get("id") || (genres[0]?.id?.toString() || "");

  const loadGenre = useCallback(async (genreId) => {
    if (!genreId) return;
    setLoading(true);
    setMovies([]);
    try {
      const res = await fetchByGenre(genreId, 1);
      setMovies(res.data.results);
      setTotalPages(res.data.total_pages);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGenre(activeGenre);
  }, [activeGenre, loadGenre]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoading(true);
    try {
      const res = await fetchByGenre(activeGenre, nextPage);
      setMovies((prev) => [...prev, ...res.data.results]);
      setPage(nextPage);
      setTotalPages(res.data.total_pages);
    } finally {
      setLoading(false);
    }
  };

  const activeGenreName =
    genres.find((g) => g.id.toString() === activeGenre)?.name || "Movies";

  return (
    <div className="genre-page">
      <div className="genre-page__header">
        <h1>Browse by Genre</h1>
      </div>

      <div className="genre-page__tags">
        {genres.map((g) => (
          <button
            key={g.id}
            className={`genre-page__tag ${
              g.id.toString() === activeGenre ? "genre-page__tag--active" : ""
            }`}
            onClick={() => setSearchParams({ id: g.id })}
          >
            {g.name}
          </button>
        ))}
      </div>

      {loading && movies.length === 0 ? (
        <div className="genre-page__loading">Loading...</div>
      ) : (
        <>
          <MovieGrid movies={movies} title={activeGenreName} />
          {page < totalPages && (
            <div className="genre-page__loadmore">
              <button
                className="genre-page__btn"
                onClick={loadMore}
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
