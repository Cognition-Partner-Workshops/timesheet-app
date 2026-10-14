import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../test/test-utils';
import type { AuthContextType } from '../contexts/AuthContextValue';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  const mockLogin = vi.fn();

  const authValue: AuthContextType = {
    user: null,
    login: mockLogin,
    logout: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    renderWithProviders(<LoginPage />, { authValue });

    expect(screen.getByRole('heading', { name: /time tracker/i })).toBeInTheDocument();
    expect(screen.getByText(/enter your email to log in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('displays info alert about no password', () => {
    renderWithProviders(<LoginPage />, { authValue });

    expect(
      screen.getByText(/this app intentionally does not have a password field/i)
    ).toBeInTheDocument();
  });

  it('disables submit button when email is empty', () => {
    renderWithProviders(<LoginPage />, { authValue });

    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  it('enables submit button when email is entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { authValue });

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');

    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  it('calls login and navigates to dashboard on successful submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { authValue });

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com');
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'Invalid email address' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { authValue });

    await user.type(screen.getByLabelText(/email address/i), 'invalid@test.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('displays generic error message when no specific error provided', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { authValue });

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('disables input and button while loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { authValue });

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    });
  });
});
