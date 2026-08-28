import { createContext } from 'react';
import { type ActiveTimer } from '../types/api';

export interface TimerState {
  timer: ActiveTimer | null;
  isRunning: boolean;
  elapsedSeconds: number;
}

export interface TimerContextType {
  state: TimerState;
  startTimer: (clientId: number, description?: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  discardTimer: () => Promise<void>;
  refreshTimer: () => Promise<void>;
}

export const TimerContext = createContext<TimerContextType | undefined>(undefined);
