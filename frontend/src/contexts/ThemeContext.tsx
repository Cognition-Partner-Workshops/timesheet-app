import React, { useState, useCallback, type ReactNode } from 'react';
import { ThemeContext, type ThemeMode } from './ThemeContextValue';

interface ThemeProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'themeMode';

const getInitialMode = (): ThemeMode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
};

export const ThemeModeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
