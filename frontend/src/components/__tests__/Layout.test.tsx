import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Layout from '../Layout';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', createdAt: '2024-01-01' },
    logout: vi.fn(),
    login: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
  }),
}));

describe('Layout', () => {
  it('should render the sidebar with all navigation items', () => {
    render(
      <Layout>
        <div>Page Content</div>
      </Layout>
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clients').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Work Entries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(1);
  });
});
