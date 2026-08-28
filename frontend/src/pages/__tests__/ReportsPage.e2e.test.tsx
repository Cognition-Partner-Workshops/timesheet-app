import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '../ReportsPage';

const mockGetClients = vi.fn();
const mockGetClientReport = vi.fn();
const mockExportClientReportCsv = vi.fn();
const mockExportClientReportPdf = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    getClients: (...args: unknown[]) => mockGetClients(...args),
    getClientReport: (...args: unknown[]) => mockGetClientReport(...args),
    exportClientReportCsv: (...args: unknown[]) => mockExportClientReportCsv(...args),
    exportClientReportPdf: (...args: unknown[]) => mockExportClientReportPdf(...args),
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const sampleClients = [
  { id: 1, name: 'Acme Corp', description: 'Desc', department: 'Eng', email: 'a@b.com', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, name: 'Beta LLC', description: null, department: null, email: null, created_at: '2024-02-01', updated_at: '2024-02-01' },
];

const sampleReport = {
  client: sampleClients[0],
  totalHours: 24.5,
  entryCount: 5,
  workEntries: [
    { id: 1, client_id: 1, hours: 8, date: '2024-03-01', description: 'Backend work', created_at: '2024-03-01', updated_at: '2024-03-01' },
    { id: 2, client_id: 1, hours: 6.5, date: '2024-03-02', description: null, created_at: '2024-03-02', updated_at: '2024-03-02' },
    { id: 3, client_id: 1, hours: 4, date: '2024-03-03', description: 'Meeting', created_at: '2024-03-03', updated_at: '2024-03-03' },
    { id: 4, client_id: 1, hours: 3, date: '2024-03-04', description: 'Code review', created_at: '2024-03-04', updated_at: '2024-03-04' },
    { id: 5, client_id: 1, hours: 3, date: '2024-03-05', description: 'Deploy', created_at: '2024-03-05', updated_at: '2024-03-05' },
  ],
};

const emptyReport = {
  client: sampleClients[1],
  totalHours: 0,
  entryCount: 0,
  workEntries: [],
};

describe('ReportsPage E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Page loading & initial display
  // ---------------------------------------------------------------------------
  describe('page loading and initial display', () => {
    it('should show a loading spinner while clients are being fetched', () => {
      mockGetClients.mockReturnValue(new Promise(() => {}));
      renderWithQueryClient(<ReportsPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render the Reports title once loaded', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      renderWithQueryClient(<ReportsPage />);

      expect(await screen.findByText('Reports')).toBeInTheDocument();
    });

    it('should show the "create client first" prompt when there are no clients', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ReportsPage />);

      expect(
        await screen.findByText('You need to create at least one client before generating reports.')
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /create client/i })).toBeInTheDocument();
    });

    it('should show "Select a client" prompt when clients exist but none is selected', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      renderWithQueryClient(<ReportsPage />);

      expect(await screen.findByText('Select a client to view their time report.')).toBeInTheDocument();
    });

    it('should render the client selector dropdown', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      renderWithQueryClient(<ReportsPage />);

      expect(await screen.findByRole('combobox')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Client selection and report display
  // ---------------------------------------------------------------------------
  describe('client selection and report display', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
    });

    it('should load and display report data after selecting a client', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      const option = await screen.findByRole('option', { name: 'Acme Corp' });
      await userEvent.click(option);

      expect(await screen.findByText('24.50')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display the Total Hours card', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('Total Hours')).toBeInTheDocument();
      expect(screen.getByText('24.50')).toBeInTheDocument();
    });

    it('should display the Total Entries card', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('Total Entries')).toBeInTheDocument();
    });

    it('should display the Average Hours per Entry card', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('Average Hours per Entry')).toBeInTheDocument();
      expect(screen.getByText('4.90')).toBeInTheDocument();
    });

    it('should display the work entries table with correct columns', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      const expectedHeaders = ['Date', 'Hours', 'Description', 'Created'];
      for (const header of expectedHeaders) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it('should display work entry descriptions in the report table', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('Backend work')).toBeInTheDocument();
      expect(screen.getByText('Meeting')).toBeInTheDocument();
      expect(screen.getByText('Code review')).toBeInTheDocument();
    });

    it('should show "No description" chip for entries without description', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('No description')).toBeInTheDocument();
    });

    it('should display hours chips in the report table', async () => {
      mockGetClientReport.mockResolvedValue(sampleReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('8 hours')).toBeInTheDocument();
      expect(screen.getByText('6.5 hours')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty report for a client
  // ---------------------------------------------------------------------------
  describe('empty report for a client', () => {
    it('should show empty state when client has no entries', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetClientReport.mockResolvedValue(emptyReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Beta LLC' }));

      expect(
        await screen.findByText('No work entries found for this client.')
      ).toBeInTheDocument();
    });

    it('should show 0.00 total hours for empty report', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetClientReport.mockResolvedValue(emptyReport);
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Beta LLC' }));

      const totalHoursCard = (await screen.findByText('Total Hours')).closest('[class*="MuiCard-root"]')!;
      expect(totalHoursCard).toHaveTextContent('0.00');
    });
  });

  // ---------------------------------------------------------------------------
  // Export functionality
  // ---------------------------------------------------------------------------
  describe('export functionality', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetClientReport.mockResolvedValue(sampleReport);
    });

    it('should have export buttons disabled when no client is selected', async () => {
      renderWithQueryClient(<ReportsPage />);
      await screen.findByText('Reports');

      const csvButton = screen.getByLabelText(/export as csv/i);
      const pdfButton = screen.getByLabelText(/export as pdf/i);

      expect(csvButton).toBeDisabled();
      expect(pdfButton).toBeDisabled();
    });

    it('should enable export buttons after selecting a client', async () => {
      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      await waitFor(() => {
        expect(screen.getByLabelText(/export as csv/i)).toBeEnabled();
        expect(screen.getByLabelText(/export as pdf/i)).toBeEnabled();
      });
    });

    it('should call exportClientReportCsv when CSV button is clicked', async () => {
      mockExportClientReportCsv.mockResolvedValue(new Blob(['csv data']));
      global.URL.createObjectURL = vi.fn(() => 'blob:url');
      global.URL.revokeObjectURL = vi.fn();

      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      await waitFor(() => {
        expect(screen.getByLabelText(/export as csv/i)).toBeEnabled();
      });

      await userEvent.click(screen.getByLabelText(/export as csv/i));

      await waitFor(() => {
        expect(mockExportClientReportCsv).toHaveBeenCalledWith(1);
      });
    });

    it('should call exportClientReportPdf when PDF button is clicked', async () => {
      mockExportClientReportPdf.mockResolvedValue(new Blob(['pdf data']));
      global.URL.createObjectURL = vi.fn(() => 'blob:url');
      global.URL.revokeObjectURL = vi.fn();

      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      await waitFor(() => {
        expect(screen.getByLabelText(/export as pdf/i)).toBeEnabled();
      });

      await userEvent.click(screen.getByLabelText(/export as pdf/i));

      await waitFor(() => {
        expect(mockExportClientReportPdf).toHaveBeenCalledWith(1);
      });
    });

    it('should show an error alert when CSV export fails', async () => {
      mockExportClientReportCsv.mockRejectedValue(new Error('Export error'));

      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      await waitFor(() => {
        expect(screen.getByLabelText(/export as csv/i)).toBeEnabled();
      });

      await userEvent.click(screen.getByLabelText(/export as csv/i));

      await waitFor(() => {
        expect(screen.getByText('Failed to export CSV report')).toBeInTheDocument();
      });
    });

    it('should show an error alert when PDF export fails', async () => {
      mockExportClientReportPdf.mockRejectedValue(new Error('Export error'));

      renderWithQueryClient(<ReportsPage />);

      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      await screen.findByText('24.50');

      await waitFor(() => {
        expect(screen.getByLabelText(/export as pdf/i)).toBeEnabled();
      });

      await userEvent.click(screen.getByLabelText(/export as pdf/i));

      await waitFor(() => {
        expect(screen.getByText('Failed to export PDF report')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Full user journey
  // ---------------------------------------------------------------------------
  describe('full user journey', () => {
    it('should support selecting a client, viewing report, and switching clients', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetClientReport
        .mockResolvedValueOnce(sampleReport)
        .mockResolvedValueOnce(emptyReport);

      renderWithQueryClient(<ReportsPage />);

      // Select first client
      const select = await screen.findByRole('combobox');
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Corp' }));

      expect(await screen.findByText('24.50')).toBeInTheDocument();
      expect(screen.getByText('Backend work')).toBeInTheDocument();

      // Switch to second client
      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'Beta LLC' }));

      expect(
        await screen.findByText('No work entries found for this client.')
      ).toBeInTheDocument();
    });
  });
});
