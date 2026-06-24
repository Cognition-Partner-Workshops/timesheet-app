import React, { useState, useEffect, type ReactNode } from 'react';
import apiClient from '../api/client';
import { FeatureFlagsContext, defaultFlags, type FeatureFlags } from './FeatureFlagsContextValue';

interface FeatureFlagsProviderProps {
  children: ReactNode;
}

export const FeatureFlagsProvider: React.FC<FeatureFlagsProviderProps> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const data = await apiClient.getFeatureFlags();
        setFlags(data);
      } catch (err) {
        console.warn('Failed to load feature flags, using defaults:', err);
      }
    };
    loadFlags();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};
