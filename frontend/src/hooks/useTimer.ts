import { useContext } from 'react';
import { TimerContext, type TimerContextType } from '../contexts/TimerContextValue';

export function useTimer(): TimerContextType {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
