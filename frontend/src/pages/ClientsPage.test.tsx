import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientsPage from './ClientsPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    deleteAllClients: vi.fn(),
  },
}));

function renderClientsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClientsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner initially', () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    renderClientsPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render page title after loading', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [],
    });

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });
  });

  it('should display clients in table', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [
        { id: 1, name: 'Client A', description: 'Test client', department: 'Engineering', email: 'a@test.com', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Client B', description: null, department: null, email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
      ],
    });

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText('Client A')).toBeInTheDocument();
      expect(screen.getByText('Client B')).toBeInTheDocument();
    });
  });

  it('should show empty state when no clients exist', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [],
    });

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });

    expect(screen.getByText(/add client/i)).toBeInTheDocument();
  });

  it('should render Add Client button', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [],
    });

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText(/add client/i)).toBeInTheDocument();
    });
  });

  it('should render Clear All button when clients exist', async () => {
    (apiClient.getClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      clients: [
        { id: 1, name: 'Client A', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    renderClientsPage();

    await waitFor(() => {
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });

    expect(screen.getByText(/clear all/i)).toBeInTheDocument();
  });
});
