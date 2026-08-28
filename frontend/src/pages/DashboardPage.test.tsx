import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './DashboardPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getWorkEntries: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard title', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({ clients: [] });
    (apiClient.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({ workEntries: [] });

    renderDashboard();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should display stats cards', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [{ id: 1, name: 'Client A' }, { id: 2, name: 'Client B' }],
    });
    (apiClient.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({
      workEntries: [
        { id: 1, hours: 5, client_name: 'Client A', date: '2024-01-01' },
        { id: 2, hours: 3, client_name: 'Client B', date: '2024-01-02' },
      ],
    });

    renderDashboard();

    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
    expect(screen.getByText('Total Hours')).toBeInTheDocument();
  });

  it('should show empty state when no work entries', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({ clients: [] });
    (apiClient.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({ workEntries: [] });

    renderDashboard();

    expect(screen.getByText('Recent Work Entries')).toBeInTheDocument();
  });

  it('should render Quick Actions section', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({ clients: [] });
    (apiClient.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({ workEntries: [] });

    renderDashboard();

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('should render Add Entry button', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({ clients: [] });
    (apiClient.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({ workEntries: [] });

    renderDashboard();

    expect(screen.getByText('Add Entry')).toBeInTheDocument();
  });
});
