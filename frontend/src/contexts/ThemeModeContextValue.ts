import { createContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeModeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'light',
  toggleMode: () => {},
});
