import { useEffect, useState, useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MovieCard from "./MovieCard";
import "./MovieRow.css";

export default function MovieRow({ title, fetchFn, size = "normal" }) {
  const [movies, setMovies] = useState([]);
  const rowRef = useRef(null);

  useEffect(() => {
    fetchFn().then((res) => setMovies(res.data.results));
  }, [fetchFn]);

  const scroll = (direction) => {
    if (!rowRef.current) return;
    const amount = direction === "left" ? -600 : 600;
    rowRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="movie-row">
      <h2 className="movie-row__title">{title}</h2>
      <div className="movie-row__container">
        <button
          className="movie-row__arrow movie-row__arrow--left"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
        >
          <FiChevronLeft />
        </button>
        <div className="movie-row__list" ref={rowRef}>
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} size={size} />
          ))}
        </div>
        <button
          className="movie-row__arrow movie-row__arrow--right"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
