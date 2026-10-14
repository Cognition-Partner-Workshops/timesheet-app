import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';
import { renderWithProviders } from '../../test/test-utils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Time Tracker" heading, email input, and "Log In" button', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: /time tracker/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('disables the Log In button when email field is empty', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  it('enables the Log In button when an email is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');

    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  it('calls login() from auth context and navigates to /dashboard on submit', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, {
      authContext: { login: mockLogin },
    });

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com');
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error alert when login fails', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockRejectedValue({
      response: { data: { error: 'Invalid email address' } },
    });
    renderWithProviders(<LoginPage />, {
      authContext: { login: mockLogin },
    });

    await user.type(screen.getByLabelText(/email address/i), 'bad@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });
});
