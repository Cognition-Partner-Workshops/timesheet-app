import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';
import type { ReactNode } from 'react';

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('returns context value when inside provider', () => {
    const value: AuthContextType = {
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
      login: async () => {},
      logout: () => {},
      isLoading: false,
      isAuthenticated: true,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });
});
