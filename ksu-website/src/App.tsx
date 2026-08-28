import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import RegulationsPage from './pages/RegulationsPage';
import './App.css';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/regulations" element={<RegulationsPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
