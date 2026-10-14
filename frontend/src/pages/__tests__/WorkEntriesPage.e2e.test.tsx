import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkEntriesPage from '../WorkEntriesPage';

const mockGetClients = vi.fn();
const mockGetWorkEntries = vi.fn();
const mockCreateWorkEntry = vi.fn();
const mockUpdateWorkEntry = vi.fn();
const mockDeleteWorkEntry = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    getClients: (...args: unknown[]) => mockGetClients(...args),
    getWorkEntries: (...args: unknown[]) => mockGetWorkEntries(...args),
    createWorkEntry: (...args: unknown[]) => mockCreateWorkEntry(...args),
    updateWorkEntry: (...args: unknown[]) => mockUpdateWorkEntry(...args),
    deleteWorkEntry: (...args: unknown[]) => mockDeleteWorkEntry(...args),
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

const sampleEntry = {
  id: 1,
  client_id: 1,
  client_name: 'Acme Corp',
  hours: 8,
  date: '2024-03-15',
  description: 'Backend development',
  created_at: '2024-03-15',
  updated_at: '2024-03-15',
};

const entryNoDescription = {
  id: 2,
  client_id: 2,
  client_name: 'Beta LLC',
  hours: 3.5,
  date: '2024-04-01',
  description: null,
  created_at: '2024-04-01',
  updated_at: '2024-04-01',
};

describe('WorkEntriesPage E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWorkEntry.mockResolvedValue({ workEntry: { id: 99 } });
    mockUpdateWorkEntry.mockResolvedValue({ workEntry: sampleEntry });
    mockDeleteWorkEntry.mockResolvedValue({});
  });

  // ---------------------------------------------------------------------------
  // Page loading & initial display
  // ---------------------------------------------------------------------------
  describe('page loading and initial display', () => {
    it('should show a loading spinner while data is being fetched', () => {
      mockGetClients.mockReturnValue(new Promise(() => {}));
      mockGetWorkEntries.mockReturnValue(new Promise(() => {}));
      renderWithQueryClient(<WorkEntriesPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render the page title and Add Work Entry button when clients exist', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
      renderWithQueryClient(<WorkEntriesPage />);

      expect(await screen.findByText('Work Entries')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    it('should show the "create client first" prompt when there are no clients', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
      renderWithQueryClient(<WorkEntriesPage />);

      expect(
        await screen.findByText('You need to create at least one client before adding work entries.')
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /create client/i })).toBeInTheDocument();
    });

    it('should render the five table column headers', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
      renderWithQueryClient(<WorkEntriesPage />);

      await screen.findByText('No work entries found. Add your first work entry to get started.');

      const expectedHeaders = ['Client', 'Date', 'Hours', 'Description', 'Actions'];
      for (const header of expectedHeaders) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it('should show the empty state message when there are no work entries', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
      renderWithQueryClient(<WorkEntriesPage />);

      expect(
        await screen.findByText('No work entries found. Add your first work entry to get started.')
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Table display with work entries
  // ---------------------------------------------------------------------------
  describe('table display — with entries', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [sampleEntry] });
    });

    it('should display the client name in the table', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    });

    it('should display the formatted date', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');
      const formatted = new Date('2024-03-15').toLocaleDateString();
      expect(screen.getByText(formatted)).toBeInTheDocument();
    });

    it('should display the hours as a chip', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');
      expect(screen.getByText('8 hours')).toBeInTheDocument();
    });

    it('should display the description text', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      expect(await screen.findByText('Backend development')).toBeInTheDocument();
    });

    it('should render edit and delete action buttons', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      expect(screen.getAllByTestId('EditIcon').length).toBe(1);
      expect(screen.getAllByTestId('DeleteIcon').length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Missing optional fields
  // ---------------------------------------------------------------------------
  describe('table display — missing description shows placeholder', () => {
    it('should show "No description" chip when description is null', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [entryNoDescription] });
      renderWithQueryClient(<WorkEntriesPage />);

      await screen.findByText('Beta LLC');
      expect(screen.getByText('No description')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple entries
  // ---------------------------------------------------------------------------
  describe('table display — multiple entries', () => {
    it('should render a row for each entry', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [sampleEntry, entryNoDescription] });
      renderWithQueryClient(<WorkEntriesPage />);

      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      expect(screen.getAllByTestId('EditIcon').length).toBe(2);
      expect(screen.getAllByTestId('DeleteIcon').length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Create work entry flow
  // ---------------------------------------------------------------------------
  describe('create work entry flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
    });

    it('should open the Add New Work Entry dialog', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));

      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    it('should show a validation error when no client is selected', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));

      const form = screen.getByText('Add New Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Please select a client')).toBeInTheDocument();
      });
    });

    it('should show a validation error for invalid hours', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));

      // Select a client via the MUI Select combobox
      const clientSelect = screen.getByRole('combobox', { hidden: true });
      await userEvent.click(clientSelect);
      const option = await screen.findByRole('option', { name: 'Acme Corp' });
      await userEvent.click(option);

      const form = screen.getByText('Add New Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Hours must be between 0 and 24')).toBeInTheDocument();
      });
    });

    it('should close the dialog when Cancel is clicked without calling the API', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Work Entry')).not.toBeInTheDocument();
      });
      expect(mockCreateWorkEntry).not.toHaveBeenCalled();
    });

    it('should show an error alert when createWorkEntry API fails', async () => {
      mockCreateWorkEntry.mockRejectedValue({
        response: { data: { error: 'Entry creation failed' } },
      });

      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));

      const clientSelect = screen.getByRole('combobox', { hidden: true });
      await userEvent.click(clientSelect);
      const option = await screen.findByRole('option', { name: 'Acme Corp' });
      await userEvent.click(option);

      await userEvent.type(screen.getByLabelText(/hours/i), '5');

      const form = screen.getByText('Add New Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Entry creation failed')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edit work entry flow
  // ---------------------------------------------------------------------------
  describe('edit work entry flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [sampleEntry] });
    });

    it('should open the Edit Work Entry dialog with pre-populated fields', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      const editButton = screen.getAllByTestId('EditIcon')[0].closest('button')!;
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Work Entry')).toBeInTheDocument();
      });

      expect((screen.getByLabelText(/hours/i) as HTMLInputElement).value).toBe('8');
      expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('Backend development');
    });

    it('should show Update button instead of Create when editing', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Work Entry')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument();
    });

    it('should close the dialog after a successful update', async () => {
      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('Edit Work Entry')).toBeInTheDocument();
      });

      const form = screen.getByText('Edit Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.queryByText('Edit Work Entry')).not.toBeInTheDocument();
      });
    });

    it('should show an error alert when updateWorkEntry API fails', async () => {
      mockUpdateWorkEntry.mockRejectedValue({
        response: { data: { error: 'Update failed' } },
      });

      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('Edit Work Entry')).toBeInTheDocument();
      });

      const form = screen.getByText('Edit Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Delete work entry flow
  // ---------------------------------------------------------------------------
  describe('delete work entry flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [sampleEntry] });
    });

    it('should show a confirm dialog and delete on confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete this 8 hour entry for Acme Corp?'
        );
        expect(mockDeleteWorkEntry).toHaveBeenCalledWith(1);
      });
    });

    it('should not delete when the confirm dialog is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithQueryClient(<WorkEntriesPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteWorkEntry).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error alert dismissal
  // ---------------------------------------------------------------------------
  describe('error alert dismissal', () => {
    it('should clear the validation error when a new dialog is opened', async () => {
      mockGetClients.mockResolvedValue({ clients: sampleClients });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
      renderWithQueryClient(<WorkEntriesPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add work entry/i }));

      const form = screen.getByText('Add New Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Please select a client')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Work Entry')).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add work entry/i }));

      await waitFor(() => {
        expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
      });

      expect(screen.queryByText('Please select a client')).not.toBeInTheDocument();
    });
  });
});
