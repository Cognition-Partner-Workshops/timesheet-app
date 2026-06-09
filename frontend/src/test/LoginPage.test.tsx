import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../contexts/AuthContextValue';
import LoginPage from '../pages/LoginPage';

function renderWithProviders(ui: React.ReactElement, authOverrides: Partial<AuthContextType> = {}) {
  const defaultAuth: AuthContextType = {
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  it('renders the login form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Time Tracker')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('disables button when email is empty', () => {
    renderWithProviders(<LoginPage />);
    const btn = screen.getByRole('button', { name: /log in/i });
    expect(btn).toBeDisabled();
  });

  it('enables button when email is entered', async () => {
    renderWithProviders(<LoginPage />);
    const input = screen.getByLabelText(/email address/i);
    await userEvent.type(input, 'test@example.com');
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  it('calls login on form submit', async () => {
    const loginMock = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { login: loginMock });

    const input = screen.getByLabelText(/email address/i);
    await userEvent.type(input, 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(loginMock).toHaveBeenCalledWith('test@example.com');
  });

  it('shows error on login failure', async () => {
    const loginMock = vi.fn().mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    });
    renderWithProviders(<LoginPage />, { login: loginMock });

    const input = screen.getByLabelText(/email address/i);
    await userEvent.type(input, 'bad@example.com');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
