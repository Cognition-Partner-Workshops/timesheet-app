import { createContext, useContext, useEffect, useState } from "react";
import { fetchGenres } from "../services/tmdb";

const GenreContext = createContext();

export function GenreProvider({ children }) {
  const [genres, setGenres] = useState([]);

  useEffect(() => {
    fetchGenres().then((res) => setGenres(res.data.genres));
  }, []);

  const getGenreName = (id) => {
    const found = genres.find((g) => g.id === id);
    return found ? found.name : "";
  };

  return (
    <GenreContext.Provider value={{ genres, getGenreName }}>
      {children}
    </GenreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useGenres = () => useContext(GenreContext);
