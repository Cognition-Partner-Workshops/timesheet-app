import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '../ReportsPage';

vi.mock('../../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getClientReport: vi.fn(),
    exportClientReportCsv: vi.fn(),
    exportClientReportPdf: vi.fn(),
  },
}));

import apiClient from '../../api/client';

const mockedApiClient = vi.mocked(apiClient);

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderReportsPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows loading state initially', () => {
    mockedApiClient.getClients.mockReturnValue(new Promise(() => {}));
    renderReportsPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders client selector when clients are loaded', async () => {
    mockedApiClient.getClients.mockResolvedValueOnce({
      clients: [
        { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Beta Inc', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('export buttons are disabled when no client is selected', async () => {
    mockedApiClient.getClients.mockResolvedValueOnce({
      clients: [
        { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    const csvButton = screen.getByLabelText(/export as csv/i);
    const pdfButton = screen.getByLabelText(/export as pdf/i);

    expect(csvButton).toBeDisabled();
    expect(pdfButton).toBeDisabled();
  });

  test('shows message to create client when no clients exist', async () => {
    mockedApiClient.getClients.mockResolvedValueOnce({
      clients: [],
    });

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Create Client')).toBeInTheDocument();
  });

  test('displays report data when client is selected', async () => {
    mockedApiClient.getClients.mockResolvedValueOnce({
      clients: [
        { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    mockedApiClient.getClientReport.mockResolvedValueOnce({
      client: { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      workEntries: [
        { id: 1, client_id: 1, hours: 8, description: 'Development work', date: '2024-01-15', created_at: '2024-01-15', updated_at: '2024-01-15' },
      ],
      totalHours: 8,
      entryCount: 1,
    });

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    // Select a client via the MUI Select combobox
    const selectElement = screen.getByRole('combobox');
    fireEvent.mouseDown(selectElement);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Acme Corp'));

    await waitFor(() => {
      expect(screen.getByText('Total Hours')).toBeInTheDocument();
    });

    const hourValues = screen.getAllByText('8.00');
    expect(hourValues.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Entries')).toBeInTheDocument();
    expect(screen.getByText('Development work')).toBeInTheDocument();
  });

  test('shows prompt to select client when none selected', async () => {
    mockedApiClient.getClients.mockResolvedValueOnce({
      clients: [
        { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    expect(screen.getByText(/select a client to view their time report/i)).toBeInTheDocument();
  });
});
