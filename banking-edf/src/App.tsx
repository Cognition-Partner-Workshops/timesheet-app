import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import DataTransfer from './pages/DataTransfer';
import DataValidation from './pages/DataValidation';
import Verification from './pages/Verification';
import Settings from './pages/Settings';

function App() {
  return (
    <ThemeProvider>
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="sources" element={<DataSources />} />
              <Route path="transfer" element={<DataTransfer />} />
              <Route path="validation" element={<DataValidation />} />
              <Route path="verification" element={<Verification />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
