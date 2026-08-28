import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GenreProvider } from "./context/GenreContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Search from "./pages/Search";
import MovieDetails from "./pages/MovieDetails";
import Genre from "./pages/Genre";
import "./App.css";

export default function App() {
  return (
    <GenreProvider>
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/genre" element={<Genre />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </GenreProvider>
  );
}
