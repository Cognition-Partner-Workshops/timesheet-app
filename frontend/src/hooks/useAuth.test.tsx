import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';
import React from 'react';

describe('useAuth', () => {
  it('should return context value when used within AuthProvider', () => {
    const mockContextValue: AuthContextType = {
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
      login: async () => {},
      logout: () => {},
      isLoading: false,
      isAuthenticated: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual({ email: 'test@example.com', createdAt: '2024-01-01' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
