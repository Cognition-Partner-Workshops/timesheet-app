import MovieCard from "./MovieCard";
import "./MovieGrid.css";

export default function MovieGrid({ movies, title }) {
  return (
    <div className="movie-grid">
      {title && <h2 className="movie-grid__title">{title}</h2>}
      <div className="movie-grid__list">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
      {movies.length === 0 && (
        <p className="movie-grid__empty">No movies found.</p>
      )}
    </div>
  );
}
