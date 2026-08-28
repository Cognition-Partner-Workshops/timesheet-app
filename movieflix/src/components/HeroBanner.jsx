import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTrending, IMG_SIZES } from "../services/tmdb";
import { FiPlay, FiInfo } from "react-icons/fi";
import "./HeroBanner.css";

export default function HeroBanner() {
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrending().then((res) => {
      const movies = res.data.results;
      setMovie(movies[Math.floor(Math.random() * movies.length)]);
    });
  }, []);

  if (!movie) return <div className="hero-banner hero-banner--loading" />;

  const truncate = (str, n) =>
    str && str.length > n ? str.substring(0, n) + "..." : str;

  return (
    <div
      className="hero-banner"
      style={{
        backgroundImage: `url(${IMG_SIZES.backdrop}${movie.backdrop_path})`,
      }}
    >
      <div className="hero-banner__overlay" />
      <div className="hero-banner__content">
        <h1 className="hero-banner__title">
          {movie.title || movie.name}
        </h1>
        <p className="hero-banner__overview">
          {truncate(movie.overview, 200)}
        </p>
        <div className="hero-banner__actions">
          <button
            className="hero-banner__btn hero-banner__btn--play"
            onClick={() => navigate(`/movie/${movie.id}`)}
          >
            <FiPlay /> Play
          </button>
          <button
            className="hero-banner__btn hero-banner__btn--info"
            onClick={() => navigate(`/movie/${movie.id}`)}
          >
            <FiInfo /> More Info
          </button>
        </div>
      </div>
      <div className="hero-banner__fadeBottom" />
    </div>
  );
}
