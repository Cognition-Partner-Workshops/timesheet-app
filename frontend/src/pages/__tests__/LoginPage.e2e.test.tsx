import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Page rendering and initial display
  // ---------------------------------------------------------------------------
  describe('page rendering and initial display', () => {
    it('should render the app title "Time Tracker"', () => {
      renderLoginPage();
      expect(screen.getByText('Time Tracker')).toBeInTheDocument();
    });

    it('should render the subtitle prompting email entry', () => {
      renderLoginPage();
      expect(screen.getByText('Enter your email to log in')).toBeInTheDocument();
    });

    it('should show an info alert about passwordless login', () => {
      renderLoginPage();
      expect(
        screen.getByText('This app intentionally does not have a password field.')
      ).toBeInTheDocument();
    });

    it('should render an email input field', () => {
      renderLoginPage();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it('should render a Log In button', () => {
      renderLoginPage();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('should have the Log In button disabled when email is empty', () => {
      renderLoginPage();
      expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
    });

    it('should not display any error alerts initially', () => {
      renderLoginPage();
      const alerts = screen.queryAllByRole('alert');
      const errorAlerts = alerts.filter(
        (alert) => alert.classList.contains('MuiAlert-standardError')
      );
      expect(errorAlerts.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Form interaction
  // ---------------------------------------------------------------------------
  describe('form interaction', () => {
    it('should enable the Log In button when email is typed', async () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });

    it('should call login with the entered email on form submit', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('user@test.com');
      });
    });

    it('should navigate to /dashboard after a successful login', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should disable the email input while login is in progress', async () => {
      mockLogin.mockReturnValue(new Promise(() => {})); // never resolves
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      });
    });

    it('should show a loading spinner in the button while login is in progress', async () => {
      mockLogin.mockReturnValue(new Promise(() => {})); // never resolves
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('should display the server error message when login fails', async () => {
      mockLogin.mockRejectedValue({
        response: { data: { error: 'Invalid email address' } },
      });
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'bad@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('should show a generic error when the server provides no message', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'bad@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
      });
    });

    it('should clear the error when the form is re-submitted', async () => {
      mockLogin
        .mockRejectedValueOnce({
          response: { data: { error: 'First error' } },
        })
        .mockResolvedValueOnce(undefined);

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });

    it('should re-enable the button after login fails', async () => {
      mockLogin.mockRejectedValue({ response: { data: { error: 'Fail' } } });
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Full user journey
  // ---------------------------------------------------------------------------
  describe('full user journey', () => {
    it('should support typing email, submitting, and navigating on success', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();

      await userEvent.type(emailInput, 'journey@test.com');
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();

      await userEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('journey@test.com');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});
