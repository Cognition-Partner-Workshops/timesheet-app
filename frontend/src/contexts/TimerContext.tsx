import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { type ActiveTimer } from '../types/api';
import apiClient from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { TimerContext, type TimerState } from './TimerContextValue';

const STORAGE_KEY = 'activeTimer';

const EMPTY_STATE: TimerState = { timer: null, isRunning: false, elapsedSeconds: 0 };

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<TimerState>(EMPTY_STATE);
  const intervalRef = useRef<number | null>(null);
  const prevAuthRef = useRef<boolean>(isAuthenticated);

  const calcElapsed = useCallback((startedAt: string): number => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  }, []);

  const startTicking = useCallback((startedAt: string) => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      setState(prev => {
        if (!prev.timer) return prev;
        return { ...prev, elapsedSeconds: calcElapsed(startedAt) };
      });
    }, 1000);
  }, [calcElapsed]);

  const stopTicking = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refreshTimer = useCallback(async () => {
    try {
      const response = await apiClient.getActiveTimer();
      const timer = response.timer as ActiveTimer;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
      setState({
        timer,
        isRunning: true,
        elapsedSeconds: calcElapsed(timer.started_at),
      });
      startTicking(timer.started_at);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      stopTicking();
      setState(EMPTY_STATE);
    }
  }, [calcElapsed, startTicking, stopTicking]);

  // Handle auth changes: clear state when logging out
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      stopTicking();
      localStorage.removeItem(STORAGE_KEY);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, stopTicking]);

  // Initialize from localStorage then sync with backend
  useEffect(() => {
    if (!isAuthenticated) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const timer = JSON.parse(stored) as ActiveTimer;
        startTicking(timer.started_at);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    let cancelled = false;

    const syncWithBackend = async () => {
      try {
        const response = await apiClient.getActiveTimer();
        if (cancelled) return;
        const timer = response.timer as ActiveTimer;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
        setState({
          timer,
          isRunning: true,
          elapsedSeconds: calcElapsed(timer.started_at),
        });
        startTicking(timer.started_at);
      } catch {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        stopTicking();
        setState(EMPTY_STATE);
      }
    };

    syncWithBackend();

    return () => {
      cancelled = true;
      stopTicking();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const startTimerAction = useCallback(async (clientId: number, description?: string) => {
    const response = await apiClient.startTimer({ clientId, description });
    const timer = response.timer as ActiveTimer;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    setState({
      timer,
      isRunning: true,
      elapsedSeconds: calcElapsed(timer.started_at),
    });
    startTicking(timer.started_at);
  }, [calcElapsed, startTicking]);

  const stopTimerAction = useCallback(async () => {
    await apiClient.stopTimer();
    localStorage.removeItem(STORAGE_KEY);
    stopTicking();
    setState(EMPTY_STATE);
  }, [stopTicking]);

  const discardTimerAction = useCallback(async () => {
    await apiClient.discardTimer();
    localStorage.removeItem(STORAGE_KEY);
    stopTicking();
    setState(EMPTY_STATE);
  }, [stopTicking]);

  return (
    <TimerContext.Provider
      value={{
        state,
        startTimer: startTimerAction,
        stopTimer: stopTimerAction,
        discardTimer: discardTimerAction,
        refreshTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
