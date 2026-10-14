import { useContext } from 'react';
import { ThemeModeContext, type ThemeModeContextType } from '../contexts/ThemeModeContextValue';

export const useThemeMode = (): ThemeModeContextType => {
  return useContext(ThemeModeContext);
};
