import { useContext } from 'react';
import { FeatureFlagsContext, type FeatureFlags } from '../contexts/FeatureFlagsContextValue';

export const useFeatureFlags = (): FeatureFlags => {
  return useContext(FeatureFlagsContext);
};
