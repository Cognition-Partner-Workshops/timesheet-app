import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientsPage from './ClientsPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    deleteAllClients: vi.fn(),
  },
}));

import apiClient from '../api/client';

describe('ClientsPage', () => {
  const mockClients = [
    { id: 1, name: 'Acme Corp', description: 'Main client', department: 'Engineering', email: 'acme@test.com', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 2, name: 'Beta Inc', description: null, department: 'Marketing', email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: mockClients });
  });

  it('renders page heading and add button', async () => {
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /clients/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
  });

  it('displays clients in a table', async () => {
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    vi.mocked(apiClient.getClients).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ClientsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('opens the create dialog when Add Client is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    expect(screen.getByRole('heading', { name: /add new client/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
  });

  it('submits form to create a new client', async () => {
    vi.mocked(apiClient.createClient).mockResolvedValue({ client: { id: 3, name: 'New Client' } });
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));
    await user.type(screen.getByLabelText(/client name/i), 'New Client');
    await user.type(screen.getByLabelText(/description/i), 'A new client');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(apiClient.createClient).toHaveBeenCalledWith({
        name: 'New Client',
        description: 'A new client',
        department: undefined,
        email: undefined,
      });
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));
    expect(screen.getByRole('heading', { name: /add new client/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /add new client/i })).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no clients exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
    });
  });

  it('displays client description in table', async () => {
    renderWithProviders(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('Main client')).toBeInTheDocument();
  });
});
