import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientsPage from '../ClientsPage';

const mockGetClients = vi.fn();
const mockCreateClient = vi.fn();
const mockUpdateClient = vi.fn();
const mockDeleteClient = vi.fn();
const mockDeleteAllClients = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    getClients: (...args: unknown[]) => mockGetClients(...args),
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    updateClient: (...args: unknown[]) => mockUpdateClient(...args),
    deleteClient: (...args: unknown[]) => mockDeleteClient(...args),
    deleteAllClients: (...args: unknown[]) => mockDeleteAllClients(...args),
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

const fullClient = {
  id: 1,
  name: 'Acme Corp',
  description: 'A large enterprise',
  department: 'Engineering',
  email: 'acme@example.com',
  phone: '555-1234',
  created_at: '2024-03-15',
  updated_at: '2024-03-15',
};

const minimalClient = {
  id: 2,
  name: 'Beta LLC',
  description: null,
  department: null,
  email: null,
  phone: undefined,
  created_at: '2024-06-01',
  updated_at: '2024-06-01',
};

describe('ClientsPage E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ client: { id: 99, name: 'New' } });
    mockUpdateClient.mockResolvedValue({ client: fullClient });
    mockDeleteClient.mockResolvedValue({});
    mockDeleteAllClients.mockResolvedValue({});
  });

  // ---------------------------------------------------------------------------
  // Page loading & initial display
  // ---------------------------------------------------------------------------
  describe('page loading and initial display', () => {
    it('should show a loading spinner while clients are being fetched', () => {
      mockGetClients.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithQueryClient(<ClientsPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render the page title and Add Client button once loaded', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ClientsPage />);

      expect(await screen.findByText('Clients')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    it('should render all seven table column headers', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('No clients found. Create your first client to get started.');

      const expectedHeaders = ['Name', 'Department', 'Email', 'Phone', 'Description', 'Created', 'Actions'];
      for (const header of expectedHeaders) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it('should show the empty state message when there are no clients', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ClientsPage />);

      expect(
        await screen.findByText('No clients found. Create your first client to get started.')
      ).toBeInTheDocument();
    });

    it('should not show the Clear All button when there are no clients', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('No clients found. Create your first client to get started.');
      expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });

    it('should show the Clear All button when clients exist', async () => {
      mockGetClients.mockResolvedValue({ clients: [fullClient] });
      renderWithQueryClient(<ClientsPage />);

      await screen.findByText('Acme Corp');
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Table display with complete client data
  // ---------------------------------------------------------------------------
  describe('table display — full client data', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [fullClient] });
    });

    it('should display the client name in the table', async () => {
      renderWithQueryClient(<ClientsPage />);
      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    });

    it('should display the department value', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('should display the email value', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');
      expect(screen.getByText('acme@example.com')).toBeInTheDocument();
    });

    it('should display the phone value', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');
      expect(screen.getByText('555-1234')).toBeInTheDocument();
    });

    it('should display the description value', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');
      expect(screen.getByText('A large enterprise')).toBeInTheDocument();
    });

    it('should display the formatted created date', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');
      const formatted = new Date('2024-03-15').toLocaleDateString();
      expect(screen.getByText(formatted)).toBeInTheDocument();
    });

    it('should render edit and delete action buttons for each client row', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      expect(screen.getAllByTestId('EditIcon').length).toBe(1);
      expect(screen.getAllByTestId('DeleteIcon').length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Table display with minimal / missing optional fields
  // ---------------------------------------------------------------------------
  describe('table display — missing optional fields show placeholders', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [minimalClient] });
    });

    it('should show dash chips for missing department, email, and phone', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Beta LLC');

      const dashChips = screen.getAllByText('-');
      expect(dashChips.length).toBeGreaterThanOrEqual(3);
    });

    it('should show "No description" chip when description is missing', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Beta LLC');
      expect(screen.getByText('No description')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple clients rendering
  // ---------------------------------------------------------------------------
  describe('table display — multiple clients', () => {
    it('should render a row for each client', async () => {
      mockGetClients.mockResolvedValue({ clients: [fullClient, minimalClient] });
      renderWithQueryClient(<ClientsPage />);

      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta LLC')).toBeInTheDocument();

      expect(screen.getAllByTestId('EditIcon').length).toBe(2);
      expect(screen.getAllByTestId('DeleteIcon').length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Create client — full E2E flow
  // ---------------------------------------------------------------------------
  describe('create client flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [] });
    });

    it('should open the Add New Client dialog with empty fields', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));

      expect(screen.getByText('Add New Client')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/client name/i) as HTMLInputElement;
      const deptInput = screen.getByLabelText(/department/i) as HTMLInputElement;
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
      const descInput = screen.getByLabelText(/description/i) as HTMLInputElement;

      expect(nameInput.value).toBe('');
      expect(deptInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(phoneInput.value).toBe('');
      expect(descInput.value).toBe('');
    });

    it('should show a validation error when submitting with an empty name', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Client name is required')).toBeInTheDocument();
      });
    });

    it('should submit all fields including phone when creating a client', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));

      await userEvent.type(screen.getByLabelText(/client name/i), 'Gamma Inc');
      await userEvent.type(screen.getByLabelText(/department/i), 'Sales');
      await userEvent.type(screen.getByLabelText(/email/i), 'gamma@test.com');
      await userEvent.type(screen.getByLabelText(/phone/i), '555-9999');
      await userEvent.type(screen.getByLabelText(/description/i), 'Gamma description');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateClient).toHaveBeenCalledWith({
          name: 'Gamma Inc',
          department: 'Sales',
          email: 'gamma@test.com',
          phone: '555-9999',
          description: 'Gamma description',
        });
      });
    });

    it('should send optional fields as undefined when left empty', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));
      await userEvent.type(screen.getByLabelText(/client name/i), 'NameOnly Corp');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateClient).toHaveBeenCalledWith({
          name: 'NameOnly Corp',
          department: undefined,
          email: undefined,
          phone: undefined,
          description: undefined,
        });
      });
    });

    it('should close the dialog after a successful create', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));
      await userEvent.type(screen.getByLabelText(/client name/i), 'Close Test');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.queryByText('Add New Client')).not.toBeInTheDocument();
      });
    });

    it('should close the dialog when Cancel is clicked without calling the API', async () => {
      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));
      expect(screen.getByText('Add New Client')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Client')).not.toBeInTheDocument();
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('should show an error alert when createClient API fails', async () => {
      mockCreateClient.mockRejectedValue({
        response: { data: { error: 'Duplicate client name' } },
      });

      renderWithQueryClient(<ClientsPage />);

      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));
      await userEvent.type(screen.getByLabelText(/client name/i), 'Fail Client');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Duplicate client name')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edit client — full E2E flow
  // ---------------------------------------------------------------------------
  describe('edit client flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [fullClient] });
    });

    it('should open the Edit Client dialog with pre-populated fields', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      const editButton = screen.getAllByTestId('EditIcon')[0].closest('button')!;
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      expect((screen.getByLabelText(/client name/i) as HTMLInputElement).value).toBe('Acme Corp');
      expect((screen.getByLabelText(/department/i) as HTMLInputElement).value).toBe('Engineering');
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('acme@example.com');
      expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('555-1234');
      expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('A large enterprise');
    });

    it('should show Update button instead of Create when editing', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument();
    });

    it('should call updateClient with the modified data including phone', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/phone/i);
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '999-0000');

      const form = screen.getByText('Edit Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockUpdateClient).toHaveBeenCalledWith(1, {
          name: 'Acme Corp',
          department: 'Engineering',
          email: 'acme@example.com',
          phone: '999-0000',
          description: 'A large enterprise',
        });
      });
    });

    it('should close the dialog after a successful update', async () => {
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      const form = screen.getByText('Edit Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.queryByText('Edit Client')).not.toBeInTheDocument();
      });
    });

    it('should pre-populate empty strings for missing optional fields when editing a minimal client', async () => {
      mockGetClients.mockResolvedValue({ clients: [minimalClient] });
      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Beta LLC');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      expect((screen.getByLabelText(/department/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('');
    });

    it('should show an error alert when updateClient API fails', async () => {
      mockUpdateClient.mockRejectedValue({
        response: { data: { error: 'Update failed' } },
      });

      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);
      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      const form = screen.getByText('Edit Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Delete single client — full E2E flow
  // ---------------------------------------------------------------------------
  describe('delete single client flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [fullClient] });
    });

    it('should show a confirm dialog with the client name and delete on confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete "Acme Corp"?'
        );
        expect(mockDeleteClient).toHaveBeenCalledWith(1);
      });
    });

    it('should not delete when the confirm dialog is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteClient).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Delete all clients — full E2E flow
  // ---------------------------------------------------------------------------
  describe('delete all clients flow', () => {
    beforeEach(() => {
      mockGetClients.mockResolvedValue({ clients: [fullClient, minimalClient] });
    });

    it('should call deleteAllClients when Clear All is confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete ALL clients? This action cannot be undone.'
        );
        expect(mockDeleteAllClients).toHaveBeenCalled();
      });
    });

    it('should not delete all when the confirm dialog is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithQueryClient(<ClientsPage />);
      await screen.findByText('Acme Corp');

      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteAllClients).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error alert dismissal
  // ---------------------------------------------------------------------------
  describe('error alert dismissal', () => {
    it('should clear the validation error when a new dialog is opened', async () => {
      mockGetClients.mockResolvedValue({ clients: [] });
      renderWithQueryClient(<ClientsPage />);

      // Open dialog and trigger validation error
      await userEvent.click(await screen.findByRole('button', { name: /add client/i }));

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Client name is required')).toBeInTheDocument();
      });

      // Cancel and re-open — error should be cleared
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Client')).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add client/i }));

      await waitFor(() => {
        expect(screen.getByText('Add New Client')).toBeInTheDocument();
      });

      expect(screen.queryByText('Client name is required')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Full user journey: create → see in table → edit → delete
  // ---------------------------------------------------------------------------
  describe('full user journey', () => {
    it('should support creating a client with phone, then editing phone', async () => {
      // Start with empty list, after create the list refreshes with the new client
      let callCount = 0;
      mockGetClients.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve({ clients: [] });
        }
        return Promise.resolve({
          clients: [
            { id: 10, name: 'Journey Corp', description: 'Journey desc', department: 'QA', email: 'j@test.com', phone: '111-2222', created_at: '2024-08-01', updated_at: '2024-08-01' },
          ],
        });
      });

      renderWithQueryClient(<ClientsPage />);

      // Wait for empty state
      await screen.findByText('No clients found. Create your first client to get started.');

      // Create
      await userEvent.click(screen.getByRole('button', { name: /add client/i }));
      await userEvent.type(screen.getByLabelText(/client name/i), 'Journey Corp');
      await userEvent.type(screen.getByLabelText(/department/i), 'QA');
      await userEvent.type(screen.getByLabelText(/email/i), 'j@test.com');
      await userEvent.type(screen.getByLabelText(/phone/i), '111-2222');
      await userEvent.type(screen.getByLabelText(/description/i), 'Journey desc');

      const form = screen.getByText('Add New Client').closest('div')?.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateClient).toHaveBeenCalledWith({
          name: 'Journey Corp',
          department: 'QA',
          email: 'j@test.com',
          phone: '111-2222',
          description: 'Journey desc',
        });
      });

      // After successful create, the client appears in table
      await screen.findByText('Journey Corp');
      expect(screen.getByText('111-2222')).toBeInTheDocument();

      // Edit the phone
      await userEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Edit Client')).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/phone/i);
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '333-4444');

      const editForm = screen.getByText('Edit Client').closest('div')?.querySelector('form');
      fireEvent.submit(editForm!);

      await waitFor(() => {
        expect(mockUpdateClient).toHaveBeenCalledWith(10, {
          name: 'Journey Corp',
          department: 'QA',
          email: 'j@test.com',
          phone: '333-4444',
          description: 'Journey desc',
        });
      });
    });
  });
});
