import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkEntriesPage from './WorkEntriesPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getWorkEntries: vi.fn(),
    createWorkEntry: vi.fn(),
    updateWorkEntry: vi.fn(),
    deleteWorkEntry: vi.fn(),
  },
}));

import apiClient from '../api/client';

const mockClients = [
  { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, name: 'Beta Inc', description: null, department: null, email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
];

const mockWorkEntries = [
  { id: 1, client_id: 1, client_name: 'Acme Corp', hours: 4, date: '2024-01-15', description: 'Feature work', created_at: '2024-01-15', updated_at: '2024-01-15' },
  { id: 2, client_id: 2, client_name: 'Beta Inc', hours: 2.5, date: '2024-01-16', description: null, created_at: '2024-01-16', updated_at: '2024-01-16' },
];

describe('WorkEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: mockClients });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: mockWorkEntries });
  });

  it('renders page heading and add button', async () => {
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /work entries/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
  });

  it('displays work entries in a table', async () => {
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('2.5 hours')).toBeInTheDocument();
    expect(screen.getByText('Feature work')).toBeInTheDocument();
  });

  it('shows loading spinner while data is fetching', () => {
    vi.mocked(apiClient.getClients).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.getWorkEntries).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<WorkEntriesPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows prompt to create client when no clients exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/you need to create at least one client before adding work entries/i)
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when no work entries exist', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no work entries found/i)).toBeInTheDocument();
    });
  });

  it('opens create dialog when Add Work Entry is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    expect(screen.getByRole('heading', { name: /add new work entry/i })).toBeInTheDocument();
  });

  it('shows table headers correctly', async () => {
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Client')).toBeInTheDocument();
    });
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
