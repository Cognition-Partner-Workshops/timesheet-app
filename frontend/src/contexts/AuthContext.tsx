/**
 * @fileoverview Authentication context provider.
 *
 * Manages user session state (login, logout, and re-hydration on page reload)
 * and distributes it to the component tree via React Context.
 *
 * Uses the passwordless (email-only) auth flow backed by the Express API.
 * Credentials are persisted in `localStorage` under the key `userEmail`.
 *
 * @module contexts/AuthContext
 */

import React, { useState, useEffect, type ReactNode } from 'react';
import { type User } from '../types/api';
import apiClient from '../api/client';
import { AuthContext, type AuthContextType } from './AuthContextValue';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides authentication state to descendant components.
 *
 * On mount, checks `localStorage` for a stored email and attempts to
 * re-validate the session via `GET /api/auth/me`. If validation fails the
 * stored email is cleared so the user is redirected to the login page.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-hydrate session from localStorage on initial mount.
  useEffect(() => {
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem('userEmail');
      
      if (storedEmail) {
        try {
          const response = await apiClient.getCurrentUser();
          setUser(response.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('userEmail');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  /** Log in with the given email, persisting it for future sessions. */
  const login = async (email: string) => {
    try {
      const response = await apiClient.login(email);
      setUser(response.user);
      localStorage.setItem('userEmail', email);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  /** Clear session state and remove stored credentials. */
  const logout = () => {
    setUser(null);
    localStorage.removeItem('userEmail');
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
