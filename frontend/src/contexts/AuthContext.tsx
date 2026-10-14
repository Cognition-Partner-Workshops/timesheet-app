import React, { useState, useEffect, type ReactNode } from 'react';
import { type User } from '../types/api';
import apiClient from '../api/client';
import { AuthContext, type AuthContextType } from './AuthContextValue';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.getCurrentUser();
        setUser(response.user);
      } catch {
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await apiClient.register(email, password);
      setUser(response.user);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
