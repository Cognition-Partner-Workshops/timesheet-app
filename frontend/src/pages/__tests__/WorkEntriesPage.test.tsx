import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkEntriesPage from '../WorkEntriesPage';
import { renderWithProviders } from '../../test/test-utils';
import apiClient from '../../api/client';

vi.mock('../../api/client');

const mockClients = {
  clients: [
    { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 2, name: 'Globex Inc', description: null, department: null, email: null, created_at: '2024-01-02', updated_at: '2024-01-02' },
  ],
};

const mockWorkEntries = {
  workEntries: [
    { id: 1, client_id: 1, client_name: 'Acme Corp', hours: 4, date: '2024-03-10', description: 'Development work', created_at: '2024-03-10', updated_at: '2024-03-10' },
    { id: 2, client_id: 2, client_name: 'Globex Inc', hours: 2.5, date: '2024-03-11', description: null, created_at: '2024-03-11', updated_at: '2024-03-11' },
  ],
};

describe('WorkEntriesPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.getClients).mockResolvedValue(mockClients);
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue(mockWorkEntries);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Work Entries" heading and "Add Work Entry" button', async () => {
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /work entries/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    vi.mocked(apiClient.getWorkEntries).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.getClients).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<WorkEntriesPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('when no clients exist, shows "You need to create at least one client" message', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument();
    });
  });

  it('when clients exist but no entries, shows "No work entries found" empty state', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no work entries found/i)).toBeInTheDocument();
    });
  });

  it('renders table rows with client name, date, hours chip, description', async () => {
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('Development work')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    expect(screen.getByText('2.5 hours')).toBeInTheDocument();
  });

  it('clicking "Add Work Entry" opens dialog with title "Add New Work Entry"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });
  });

  it('form validation: submitting without selecting a client shows "Please select a client"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    // Fill in hours to bypass native HTML required validation, but leave client unselected
    const hoursInput = screen.getByLabelText(/hours/i);
    await user.type(hoursInput, '5');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a client')).toBeInTheDocument();
    });
  });
});
