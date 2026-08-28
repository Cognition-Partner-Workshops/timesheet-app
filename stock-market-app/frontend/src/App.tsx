import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorState';
import { LandingPage } from './pages/LandingPage';
import { SectorDetailPage } from './pages/SectorDetailPage';
import { StockDetailPage } from './pages/StockDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/sectors/:name" element={<SectorDetailPage />} />
                <Route path="/stocks/:symbol" element={<StockDetailPage />} />
              </Routes>
            </main>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
