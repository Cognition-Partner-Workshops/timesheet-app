import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders form with email field and submit button', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByText(/time tracker/i)).toBeInTheDocument();
  });

  test('submit button is disabled when email is empty', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  test('submit calls login with entered email and navigates to dashboard', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('displays error on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'Invalid email' } },
    });
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });

    const submitButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });
  });

  test('displays generic error when login fails without specific message', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });

    const submitButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });
});
