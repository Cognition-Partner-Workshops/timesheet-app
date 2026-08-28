import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn()
}));

vi.mock('../api/client', () => ({ default: api }));

function Consumer() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  return (
    <>
      <output data-testid="state">{isLoading ? 'loading' : isAuthenticated ? user?.email : 'signed out'}</output>
      <button onClick={() => login('new@example.com')}>Login</button>
      <button onClick={logout}>Logout</button>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getCurrentUser.mockReset();
    api.login.mockReset();
  });

  it('logs in, stores the email, and logs out', async () => {
    api.login.mockResolvedValue({ user: { email: 'new@example.com' } });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByTestId('state')).toHaveTextContent('new@example.com');
    expect(localStorage.getItem('userEmail')).toBe('new@example.com');

    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByTestId('state')).toHaveTextContent('signed out');
    expect(localStorage.getItem('userEmail')).toBeNull();
  });

  it('restores a stored session from the current user endpoint', async () => {
    localStorage.setItem('userEmail', 'stored@example.com');
    api.getCurrentUser.mockResolvedValue({ user: { email: 'stored@example.com' } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('stored@example.com'));
    expect(api.getCurrentUser).toHaveBeenCalledOnce();
  });
});
