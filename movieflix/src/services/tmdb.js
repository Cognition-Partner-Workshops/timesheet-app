import axios from "axios";

const API_KEY = "2dca580c2a14b55200e784d157207b4d";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export const IMG_SIZES = {
  backdrop: `${IMAGE_BASE}/original`,
  poster: `${IMAGE_BASE}/w500`,
  posterSmall: `${IMAGE_BASE}/w342`,
  profile: `${IMAGE_BASE}/w185`,
};

const tmdb = axios.create({
  baseURL: BASE_URL,
  params: { api_key: API_KEY, language: "en-US" },
});

export const fetchTrending = (page = 1) =>
  tmdb.get("/trending/movie/week", { params: { page } });

export const fetchPopular = (page = 1) =>
  tmdb.get("/movie/popular", { params: { page } });

export const fetchTopRated = (page = 1) =>
  tmdb.get("/movie/top_rated", { params: { page } });

export const fetchUpcoming = (page = 1) =>
  tmdb.get("/movie/upcoming", { params: { page } });

export const fetchNowPlaying = (page = 1) =>
  tmdb.get("/movie/now_playing", { params: { page } });

export const fetchMovieDetails = (id) =>
  tmdb.get(`/movie/${id}`, { params: { append_to_response: "videos,credits,similar,recommendations" } });

export const fetchGenres = () => tmdb.get("/genre/movie/list");

export const fetchByGenre = (genreId, page = 1) =>
  tmdb.get("/discover/movie", { params: { with_genres: genreId, page, sort_by: "popularity.desc" } });

export const searchMovies = (query, page = 1) =>
  tmdb.get("/search/movie", { params: { query, page } });

export const discoverMovies = (params = {}) =>
  tmdb.get("/discover/movie", { params: { sort_by: "popularity.desc", ...params } });

export default tmdb;
