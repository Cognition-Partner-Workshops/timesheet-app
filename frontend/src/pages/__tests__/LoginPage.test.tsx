import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../LoginPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    isLoading: false,
    isAuthenticated: false,
  }),
}));

describe('LoginPage', () => {
  it('should disable the Log In button when email is empty', () => {
    render(<LoginPage />);

    const button = screen.getByRole('button', { name: /log in/i });
    expect(button).toBeDisabled();
  });
});
