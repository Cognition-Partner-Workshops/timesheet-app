import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './DashboardPage';
import { renderWithProviders } from '../test/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getWorkEntries: vi.fn(),
  },
}));

import apiClient from '../api/client';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [
        { id: 1, name: 'Client A', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Client B', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [
        { id: 1, client_id: 1, client_name: 'Client A', hours: 4, date: '2024-01-15', description: 'Worked on feature', created_at: '2024-01-15', updated_at: '2024-01-15' },
        { id: 2, client_id: 2, client_name: 'Client B', hours: 2.5, date: '2024-01-16', description: null, created_at: '2024-01-16', updated_at: '2024-01-16' },
      ],
    });
  });

  it('renders the dashboard heading', async () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('displays stats cards with correct data', async () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
    expect(screen.getByText('Total Hours')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('6.50')).toBeInTheDocument();
    });
  });

  it('displays recent work entries', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });
    expect(screen.getByText('Worked on feature')).toBeInTheDocument();
    expect(screen.getByText('Client B')).toBeInTheDocument();
  });

  it('displays empty state when no work entries', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No work entries yet')).toBeInTheDocument();
    });
  });

  it('shows quick actions section', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });

  it('navigates to work entries when Add Entry button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Entry')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Entry'));
    expect(mockNavigate).toHaveBeenCalledWith('/work-entries');
  });
});
