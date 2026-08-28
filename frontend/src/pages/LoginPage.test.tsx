import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLoginPage(authOverrides: Partial<AuthContextType> = {}) {
  const defaultAuth: AuthContextType = {
    user: null,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form', () => {
    renderLoginPage();

    expect(screen.getByText('Time Tracker')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should disable login button when email is empty', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  it('should enable login button when email is entered', () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });

    expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
  });

  it('should call login and navigate on successful submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    renderLoginPage({ login: mockLogin });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message on login failure', async () => {
    const mockLogin = vi.fn().mockRejectedValue({
      response: { data: { error: 'Invalid email format' } },
    });
    renderLoginPage({ login: mockLogin });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'bad-email' },
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });
  });

  it('should display generic error when no error message in response', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Network error'));
    renderLoginPage({ login: mockLogin });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('should show info alert about no password', () => {
    renderLoginPage();

    expect(screen.getByText(/does not have a password field/i)).toBeInTheDocument();
  });
});
