import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ReportsPage from './ReportsPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getClientReport: vi.fn(),
    exportClientReportCsv: vi.fn(),
    exportClientReportPdf: vi.fn(),
  },
}));

import apiClient from '../api/client';

const mockClients = [
  { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, name: 'Beta Inc', description: null, department: null, email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
];

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: mockClients });
  });

  it('renders page heading', async () => {
    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
    });
  });

  it('shows loading spinner while clients are loading', () => {
    vi.mocked(apiClient.getClients).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ReportsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows prompt to create client when no clients exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/you need to create at least one client before generating reports/i)
      ).toBeInTheDocument();
    });
  });

  it('renders export buttons (disabled initially)', async () => {
    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/export as csv/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/export as pdf/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/export as csv/i)).toBeDisabled();
    expect(screen.getByLabelText(/export as pdf/i)).toBeDisabled();
  });

  it('renders the client chooser prompt', async () => {
    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Choose a client...')).toBeInTheDocument();
    });
  });
});
