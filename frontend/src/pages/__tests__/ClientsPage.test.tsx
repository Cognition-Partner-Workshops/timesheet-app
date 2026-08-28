import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientsPage from '../ClientsPage';

const mockDeleteClient = vi.fn().mockResolvedValue({});
const mockCreateClient = vi.fn().mockResolvedValue({});
const mockGetClients = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    getClients: (...args: unknown[]) => mockGetClients(...args),
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    updateClient: vi.fn().mockResolvedValue({}),
    deleteClient: (...args: unknown[]) => mockDeleteClient(...args),
    deleteAllClients: vi.fn().mockResolvedValue({}),
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

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create client form fields', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [] });
    });

    it('should open the dialog with all form fields when Add Client is clicked', async () => {
      renderWithQueryClient(<ClientsPage />);

      const addButton = await screen.findByRole('button', { name: /add client/i });
      await userEvent.click(addButton);

      expect(screen.getByText('Add New Client')).toBeInTheDocument();
      expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should show validation error when submitting with empty name', async () => {
      renderWithQueryClient(<ClientsPage />);

      const addButton = await screen.findByRole('button', { name: /add client/i });
      await userEvent.click(addButton);

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Client name is required')).toBeInTheDocument();
      });
    });

    it('should call createClient with form data when submitted with valid input', async () => {
      mockCreateClient.mockResolvedValue({ client: { id: 1, name: 'New Client' } });
      renderWithQueryClient(<ClientsPage />);

      const addButton = await screen.findByRole('button', { name: /add client/i });
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText(/client name/i), 'New Client');
      await userEvent.type(screen.getByLabelText(/department/i), 'Engineering');
      await userEvent.type(screen.getByLabelText(/email/i), 'client@example.com');
      await userEvent.type(screen.getByLabelText(/phone/i), '555-1234');
      await userEvent.type(screen.getByLabelText(/description/i), 'A test client');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateClient).toHaveBeenCalledWith({
          name: 'New Client',
          department: 'Engineering',
          email: 'client@example.com',
          phone: '555-1234',
          description: 'A test client',
        });
      });
    });
  });

  describe('delete client', () => {
    it('should call deleteClient when delete is confirmed', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: 'Test', department: 'Eng', email: 'acme@test.com', phone: '555-0001', created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('Acme Corp');

      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      await userEvent.click(deleteButtons[0].closest('button')!);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete "Acme Corp"?');
        expect(mockDeleteClient).toHaveBeenCalledWith(1);
      });
    });

    it('should not call deleteClient when delete is cancelled', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: 'Test', department: 'Eng', email: 'acme@test.com', phone: '555-0001', created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('Acme Corp');

      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      await userEvent.click(deleteButtons[0].closest('button')!);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteClient).not.toHaveBeenCalled();
    });
  });

  describe('client table display', () => {
    it('should show empty state when no clients exist', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });

      renderWithQueryClient(<ClientsPage />);

      const message = await screen.findByText('No clients found. Create your first client to get started.');
      expect(message).toBeInTheDocument();
    });

    it('should render Phone column header in the table', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });

      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('No clients found. Create your first client to get started.');
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('should display client data in the table including phone', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: 'Big company', department: 'Engineering', email: 'acme@test.com', phone: '555-9876', created_at: '2024-01-15', updated_at: '2024-01-15' },
        ],
      });

      renderWithQueryClient(<ClientsPage />);

      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('acme@test.com')).toBeInTheDocument();
      expect(screen.getByText('555-9876')).toBeInTheDocument();
      expect(screen.getByText('Big company')).toBeInTheDocument();
    });

    it('should display a dash chip when phone is not provided', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: 'Big company', department: 'Engineering', email: 'acme@test.com', created_at: '2024-01-15', updated_at: '2024-01-15' },
        ],
      });

      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('Acme Corp');
      const dashChips = screen.getAllByText('-');
      expect(dashChips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edit client with phone', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should pre-populate phone field when editing a client', async () => {
      mockGetClients.mockResolvedValue({
        clients: [
          { id: 1, name: 'Acme Corp', description: 'Test', department: 'Eng', email: 'acme@test.com', phone: '555-4321', created_at: '2024-01-01', updated_at: '2024-01-01' },
        ],
      });

      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('Acme Corp');

      const editButtons = screen.getAllByTestId('EditIcon');
      await userEvent.click(editButtons[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
      expect(phoneInput.value).toBe('555-4321');
    });
  });

  describe('create client without phone', () => {
    it('should not send phone when field is left empty', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      mockCreateClient.mockResolvedValue({ client: { id: 2, name: 'Minimal Client' } });

      renderWithQueryClient(<ClientsPage />);

      const addButton = await screen.findByRole('button', { name: /add client/i });
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText(/client name/i), 'Minimal Client');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateClient).toHaveBeenCalledWith({
          name: 'Minimal Client',
        });
      });
    });
  });
});
