import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

function TestComponent({ onLoginError }: { onLoginError?: (err: unknown) => void }) {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const handleLogin = () => {
    login('test@example.com').catch((err) => {
      if (onLoginError) onLoginError(err);
    });
  };
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <button data-testid="login-btn" onClick={handleLogin}>Login</button>
      <button data-testid="logout-btn" onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should start with loading state and no user', async () => {
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No user'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('should restore user from localStorage on mount', async () => {
    localStorage.setItem('userEmail', 'stored@example.com');
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: 'stored@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('stored@example.com');
  });

  it('should clear stored email if auth check fails', async () => {
    localStorage.setItem('userEmail', 'invalid@example.com');
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('should login and set user', async () => {
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No user'));
    (apiClient.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    expect(localStorage.getItem('userEmail')).toBe('test@example.com');
  });

  it('should logout and clear user', async () => {
    localStorage.setItem('userEmail', 'test@example.com');
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('userEmail')).toBeNull();
  });

  it('should not set user on failed login', async () => {
    (apiClient.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No user'));
    (apiClient.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Login failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onLoginError = vi.fn();

    render(
      <AuthProvider>
        <TestComponent onLoginError={onLoginError} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(onLoginError).toHaveBeenCalled();
    });

    // User should remain null after failed login
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');

    consoleSpy.mockRestore();
  });

  it('should not attempt to check auth if no stored email', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(apiClient.getCurrentUser).not.toHaveBeenCalled();
  });
});
