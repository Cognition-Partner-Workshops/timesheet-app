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
      const token = localStorage.getItem('authToken');

      if (token) {
        try {
          const response = await apiClient.getCurrentUser();
          setUser(response.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('userEmail');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const requestOtp = async (email: string) => {
    await apiClient.requestOtp(email);
  };

  const verifyOtp = async (email: string, code: string) => {
    const response = await apiClient.verifyOtp(email, code);
    setUser(response.user);
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('userEmail', email);
  };

  const resendOtp = async (email: string) => {
    await apiClient.resendOtp(email);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
  };

  const value: AuthContextType = {
    user,
    requestOtp,
    verifyOtp,
    resendOtp,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
