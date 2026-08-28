import { createContext } from 'react';

export interface FeatureFlags {
  darkMode: boolean;
}

export const defaultFlags: FeatureFlags = {
  darkMode: false,
};

export const FeatureFlagsContext = createContext<FeatureFlags>(defaultFlags);
