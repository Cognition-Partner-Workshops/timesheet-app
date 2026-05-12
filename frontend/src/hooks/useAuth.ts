/**
 * @fileoverview Custom hook for consuming authentication context.
 *
 * Provides a type-safe accessor to the {@link AuthContextType} value.
 * Must be called inside an {@link AuthProvider} — throws at runtime otherwise.
 *
 * @module hooks/useAuth
 */

import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';

/**
 * Returns the current authentication state and actions (login / logout).
 *
 * @throws {Error} If called outside of an {@link AuthProvider}.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
