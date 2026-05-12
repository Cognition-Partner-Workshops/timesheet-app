import { screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import apiClient from '../../api/client';

vi.mock('../../api/client');

const mockClients = {
  clients: [
    { id: 1, name: 'Client A', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 2, name: 'Client B', description: null, department: null, email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
    { id: 3, name: 'Client C', description: null, department: null, email: null, created_at: '2024-01-03', updated_at: '2024-01-03' },
  ],
};

const mockWorkEntries = {
  workEntries: [
    { id: 1, client_id: 1, client_name: 'Client A', hours: 8.5, date: '2024-01-10', description: 'Task 1', created_at: '2024-01-10', updated_at: '2024-01-10' },
    { id: 2, client_id: 2, client_name: 'Client B', hours: 10, date: '2024-01-11', description: 'Task 2', created_at: '2024-01-11', updated_at: '2024-01-11' },
    { id: 3, client_id: 1, client_name: 'Client A', hours: 6, date: '2024-01-12', description: 'Task 3', created_at: '2024-01-12', updated_at: '2024-01-12' },
    { id: 4, client_id: 3, client_name: 'Client C', hours: 12, date: '2024-01-13', description: 'Task 4', created_at: '2024-01-13', updated_at: '2024-01-13' },
    { id: 5, client_id: 2, client_name: 'Client B', hours: 6, date: '2024-01-14', description: 'Task 5', created_at: '2024-01-14', updated_at: '2024-01-14' },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.getClients).mockResolvedValue(mockClients);
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue(mockWorkEntries);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Dashboard" heading', async () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders three stat cards: Total Clients, Total Work Entries, Total Hours', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Clients')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
    expect(screen.getByText('Total Hours')).toBeInTheDocument();
  });

  it('displays correct counts from mocked API data', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('42.50')).toBeInTheDocument();
  });

  it('shows "No work entries yet" when work entries list is empty', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No work entries yet')).toBeInTheDocument();
    });
  });

  it('shows recent work entries with client name, hours, date', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Client A').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/8\.5 hours/)).toBeInTheDocument();
  });

  it('Quick Actions section has "Add Client", "Add Work Entry", "View Reports" buttons', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
  });
});
