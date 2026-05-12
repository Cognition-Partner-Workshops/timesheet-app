/**
 * @fileoverview Authentication context value and type definition.
 *
 * Separated from the provider component so that both the provider
 * ({@link ../AuthContext}) and the consumer hook ({@link ../../hooks/useAuth})
 * can import the context without circular dependencies.
 *
 * @module contexts/AuthContextValue
 */

import { createContext } from 'react';
import { type User } from '../types/api';

/** Shape of the value exposed by {@link AuthContext}. */
export interface AuthContextType {
  /** Currently authenticated user, or `null` when logged out. */
  user: User | null;
  /** Authenticate a user by email (passwordless). Throws on failure. */
  login: (email: string) => Promise<void>;
  /** Clear local credentials and reset user state. */
  logout: () => void;
  /** `true` while the initial auth check is in progress. */
  isLoading: boolean;
  /** Convenience flag derived from `user !== null`. */
  isAuthenticated: boolean;
}

/**
 * React context that distributes authentication state to the component tree.
 * Initialized as `undefined` — consumers must be wrapped in an {@link AuthProvider}.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
