import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchMovieDetails, IMG_SIZES } from "../services/tmdb";
import MovieRow from "../components/MovieRow";
import { FiStar, FiClock, FiCalendar, FiArrowLeft, FiPlay } from "react-icons/fi";
import "./MovieDetails.css";

export default function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMovie = useCallback(async (movieId) => {
    setLoading(true);
    try {
      const res = await fetchMovieDetails(movieId);
      setMovie(res.data);
    } finally {
      setLoading(false);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadMovie(id);
  }, [id, loadMovie]);

  if (loading) {
    return <div className="movie-details__loading">Loading...</div>;
  }

  if (!movie) return null;

  const trailer = movie.videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );
  const cast = movie.credits?.cast?.slice(0, 12) || [];
  const director = movie.credits?.crew?.find((c) => c.job === "Director");

  const fetchSimilar = () =>
    Promise.resolve({
      data: { results: movie.similar?.results || [] },
    });

  const fetchRecommended = () =>
    Promise.resolve({
      data: { results: movie.recommendations?.results || [] },
    });

  return (
    <div className="movie-details">
      <div
        className="movie-details__backdrop"
        style={{
          backgroundImage: movie.backdrop_path
            ? `url(${IMG_SIZES.backdrop}${movie.backdrop_path})`
            : "none",
        }}
      >
        <div className="movie-details__backdrop-overlay" />
      </div>

      <div className="movie-details__content">
        <button className="movie-details__back" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Back
        </button>

        <div className="movie-details__main">
          <div className="movie-details__poster-wrap">
            {movie.poster_path && (
              <img
                src={`${IMG_SIZES.poster}${movie.poster_path}`}
                alt={movie.title}
                className="movie-details__poster"
              />
            )}
          </div>

          <div className="movie-details__info">
            <h1 className="movie-details__title">{movie.title}</h1>

            {movie.tagline && (
              <p className="movie-details__tagline">&ldquo;{movie.tagline}&rdquo;</p>
            )}

            <div className="movie-details__meta">
              <span className="movie-details__rating">
                <FiStar /> {movie.vote_average?.toFixed(1)} / 10
              </span>
              <span>
                <FiCalendar /> {movie.release_date}
              </span>
              {movie.runtime > 0 && (
                <span>
                  <FiClock /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
            </div>

            <div className="movie-details__genres">
              {movie.genres?.map((g) => (
                <span key={g.id} className="movie-details__genre-tag">
                  {g.name}
                </span>
              ))}
            </div>

            <p className="movie-details__overview">{movie.overview}</p>

            {director && (
              <p className="movie-details__director">
                <strong>Director:</strong> {director.name}
              </p>
            )}

            {trailer && (
              <a
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="movie-details__trailer-btn"
              >
                <FiPlay /> Watch Trailer
              </a>
            )}
          </div>
        </div>

        {trailer && (
          <div className="movie-details__video">
            <h2>Trailer</h2>
            <div className="movie-details__video-wrapper">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Trailer"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
              />
            </div>
          </div>
        )}

        {cast.length > 0 && (
          <div className="movie-details__cast">
            <h2>Cast</h2>
            <div className="movie-details__cast-grid">
              {cast.map((person) => (
                <div key={person.credit_id} className="movie-details__cast-card">
                  {person.profile_path ? (
                    <img
                      src={`${IMG_SIZES.profile}${person.profile_path}`}
                      alt={person.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="movie-details__cast-placeholder" />
                  )}
                  <p className="movie-details__cast-name">{person.name}</p>
                  <p className="movie-details__cast-character">{person.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {movie.similar?.results?.length > 0 && (
          <MovieRow title="Similar Movies" fetchFn={fetchSimilar} />
        )}
        {movie.recommendations?.results?.length > 0 && (
          <MovieRow title="Recommended" fetchFn={fetchRecommended} />
        )}
      </div>
    </div>
  );
}
