import { useNavigate } from "react-router-dom";
import { IMG_SIZES } from "../services/tmdb";
import { FiStar } from "react-icons/fi";
import "./MovieCard.css";

export default function MovieCard({ movie, size = "normal" }) {
  const navigate = useNavigate();

  if (!movie.poster_path) return null;

  return (
    <div
      className={`movie-card movie-card--${size}`}
      onClick={() => navigate(`/movie/${movie.id}`)}
    >
      <img
        className="movie-card__poster"
        src={`${IMG_SIZES.poster}${movie.poster_path}`}
        alt={movie.title}
        loading="lazy"
      />
      <div className="movie-card__overlay">
        <h3 className="movie-card__title">{movie.title}</h3>
        <div className="movie-card__meta">
          <span className="movie-card__rating">
            <FiStar /> {movie.vote_average?.toFixed(1)}
          </span>
          <span className="movie-card__year">
            {movie.release_date?.split("-")[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
