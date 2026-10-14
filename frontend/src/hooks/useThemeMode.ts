import { useContext } from 'react';
import { ThemeContext, type ThemeContextType } from '../contexts/ThemeContextValue';

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
};
