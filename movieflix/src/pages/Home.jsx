import HeroBanner from "../components/HeroBanner";
import MovieRow from "../components/MovieRow";
import {
  fetchTrending,
  fetchPopular,
  fetchTopRated,
  fetchUpcoming,
  fetchNowPlaying,
} from "../services/tmdb";

export default function Home() {
  return (
    <div className="home">
      <HeroBanner />
      <MovieRow title="Trending Now" fetchFn={fetchTrending} size="large" />
      <MovieRow title="Popular" fetchFn={fetchPopular} />
      <MovieRow title="Top Rated" fetchFn={fetchTopRated} />
      <MovieRow title="Now Playing" fetchFn={fetchNowPlaying} />
      <MovieRow title="Upcoming" fetchFn={fetchUpcoming} />
    </div>
  );
}
