import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkEntriesPage from '../WorkEntriesPage';

const mockDeleteWorkEntry = vi.fn().mockResolvedValue({});
const mockCreateWorkEntry = vi.fn().mockResolvedValue({});
const mockGetWorkEntries = vi.fn();
const mockGetClients = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    getWorkEntries: (...args: unknown[]) => mockGetWorkEntries(...args),
    getClients: (...args: unknown[]) => mockGetClients(...args),
    createWorkEntry: (...args: unknown[]) => mockCreateWorkEntry(...args),
    deleteWorkEntry: (...args: unknown[]) => mockDeleteWorkEntry(...args),
    updateWorkEntry: vi.fn().mockResolvedValue({}),
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('WorkEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no clients exist', () => {
    it('should show a message that clients are needed and a link to create one', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });

      renderWithQueryClient(<WorkEntriesPage />);

      const message = await screen.findByText(
        'You need to create at least one client before adding work entries.'
      );
      expect(message).toBeInTheDocument();

      const createClientButton = screen.getByRole('link', { name: /create client/i });
      expect(createClientButton).toHaveAttribute('href', '/clients');
    });
  });

  describe('create work entry form fields', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });
      mockGetWorkEntries.mockResolvedValue({ workEntries: [] });
    });

    it('should open the dialog with all form fields when Add Work Entry is clicked', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      const addButton = await screen.findByRole('button', { name: /add work entry/i });
      await userEvent.click(addButton);

      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
      expect(screen.getAllByText('Client').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/hours/i)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/date/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should show validation error when submitting without selecting a client', async () => {
      renderWithQueryClient(<WorkEntriesPage />);

      const addButton = await screen.findByRole('button', { name: /add work entry/i });
      await userEvent.click(addButton);

      const form = screen.getByText('Add New Work Entry').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Please select a client')).toBeInTheDocument();
      });
    });
  });

  describe('delete work entry', () => {
    it('should call deleteWorkEntry when delete is confirmed', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });
      mockGetWorkEntries.mockResolvedValue({
        workEntries: [
          { id: 10, client_id: 1, hours: 5, description: 'Testing', date: '2024-06-15', created_at: '2024-06-15', updated_at: '2024-06-15', client_name: 'Acme Corp' },
        ],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithQueryClient(<WorkEntriesPage />);

      await screen.findByText('Acme Corp');

      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      await userEvent.click(deleteButtons[0].closest('button')!);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockDeleteWorkEntry).toHaveBeenCalledWith(10);
      });
    });

    it('should not call deleteWorkEntry when delete is cancelled', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });
      mockGetWorkEntries.mockResolvedValue({
        workEntries: [
          { id: 10, client_id: 1, hours: 5, description: 'Testing', date: '2024-06-15', created_at: '2024-06-15', updated_at: '2024-06-15', client_name: 'Acme Corp' },
        ],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithQueryClient(<WorkEntriesPage />);

      await screen.findByText('Acme Corp');

      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      await userEvent.click(deleteButtons[0].closest('button')!);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteWorkEntry).not.toHaveBeenCalled();
    });
  });
});
