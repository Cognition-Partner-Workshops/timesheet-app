import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './DashboardPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getWorkEntries: vi.fn(),
  },
}));

import apiClient from '../api/client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dashboard heading', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays stats cards with correct data', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [
        { id: 1, name: 'Client A' },
        { id: 2, name: 'Client B' },
      ],
    });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [
        { id: 1, client_name: 'Client A', hours: 5, date: '2024-01-01' },
        { id: 2, client_name: 'Client B', hours: 3.5, date: '2024-01-02' },
      ],
    });

    renderWithProviders(<DashboardPage />);

    // Wait for data to load by finding the total hours value
    expect(await screen.findByText('8.50')).toBeInTheDocument(); // Total Hours
    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
    expect(screen.getByText('Total Hours')).toBeInTheDocument();
    // Verify client count shows "2"
    const twoElements = screen.getAllByText('2');
    expect(twoElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no work entries exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No work entries yet')).toBeInTheDocument();
  });

  it('displays recent work entries', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [{ id: 1, name: 'Acme Corp' }],
    });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [
        {
          id: 1,
          client_name: 'Acme Corp',
          hours: 4,
          date: '2024-01-15',
          description: 'Designed new feature',
        },
      ],
    });

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Designed new feature')).toBeInTheDocument();
    expect(screen.getByText('Recent Work Entries')).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Add Client')).toBeInTheDocument();
    expect(screen.getByText('Add Work Entry')).toBeInTheDocument();
    expect(screen.getByText('View Reports')).toBeInTheDocument();
  });

  it('shows zero values when there are no entries', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });

    renderWithProviders(<DashboardPage />);

    // Wait for data to load, then check zero values appear
    expect(await screen.findByText('0.00')).toBeInTheDocument(); // Total Hours
    // Both Total Clients and Total Work Entries show 0
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(2);
  });

  it('limits recent entries display to 5', async () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      client_name: `Client ${i + 1}`,
      hours: i + 1,
      date: `2024-01-0${i + 1}`,
      description: `Work ${i + 1}`,
    }));

    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [{ id: 1, name: 'Client 1' }],
    });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: entries,
    });

    renderWithProviders(<DashboardPage />);

    // Should show only 5 recent entries (the first 5)
    expect(await screen.findByText('Client 1')).toBeInTheDocument();
    expect(screen.getByText('Client 5')).toBeInTheDocument();
    expect(screen.queryByText('Client 6')).not.toBeInTheDocument();
  });
});
