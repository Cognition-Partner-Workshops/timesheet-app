import React, { useState, useCallback, type ReactNode } from 'react';
import { ThemeModeContext, type ThemeMode } from './ThemeModeContextValue';

interface ThemeModeProviderProps {
  children: ReactNode;
}

export const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('themeMode');
    return stored === 'dark' ? 'dark' : 'light';
  });

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', next);
      return next;
    });
  }, []);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
};
