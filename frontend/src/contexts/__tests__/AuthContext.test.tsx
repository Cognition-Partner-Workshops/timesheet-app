import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React, { useContext } from 'react';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../AuthContextValue';

vi.mock('../../api/client', () => ({
  default: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
  },
}));

import apiClient from '../../api/client';

const mockedApiClient = vi.mocked(apiClient);

const TestConsumer: React.FC = () => {
  const auth = useContext(AuthContext);
  if (!auth) return <div>No context</div>;
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.email : 'null'}</span>
      <button data-testid="login-btn" onClick={() => auth.login('test@example.com')}>
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test('checks localStorage on mount and calls getCurrentUser if email exists', async () => {
    localStorage.setItem('userEmail', 'test@example.com');
    mockedApiClient.getCurrentUser.mockResolvedValueOnce({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockedApiClient.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  test('does not call getCurrentUser when no email in localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockedApiClient.getCurrentUser).not.toHaveBeenCalled();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  test('login calls API and sets user state', async () => {
    mockedApiClient.login.mockResolvedValueOnce({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(mockedApiClient.login).toHaveBeenCalledWith('test@example.com');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    expect(localStorage.getItem('userEmail')).toBe('test@example.com');
  });

  test('logout clears user and localStorage', async () => {
    localStorage.setItem('userEmail', 'test@example.com');
    mockedApiClient.getCurrentUser.mockResolvedValueOnce({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(localStorage.getItem('userEmail')).toBeNull();
  });

  test('failed auth check clears localStorage', async () => {
    localStorage.setItem('userEmail', 'test@example.com');
    mockedApiClient.getCurrentUser.mockRejectedValueOnce(new Error('Auth failed'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });
});
