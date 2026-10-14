import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkEntriesPage from '../WorkEntriesPage';
import { renderWithProviders } from '../../test/test-utils';
import {
  setupClientsMock, setupWorkEntriesMock,
  setupEmptyClients, setupEmptyWorkEntries,
  setupPendingClients, setupPendingWorkEntries,
} from '../../test/setup-api-mock';

vi.mock('../../api/client');

describe('WorkEntriesPage', () => {
  beforeEach(() => { setupClientsMock(); setupWorkEntriesMock(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders "Work Entries" heading and "Add Work Entry" button', async () => {
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getByRole('heading', { name: /work entries/i })).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    setupPendingWorkEntries();
    setupPendingClients();
    renderWithProviders(<WorkEntriesPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('when no clients exist, shows "You need to create at least one client" message', async () => {
    setupEmptyClients();
    setupEmptyWorkEntries();
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument(); });
  });

  it('when clients exist but no entries, shows "No work entries found" empty state', async () => {
    setupEmptyWorkEntries();
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getByText(/no work entries found/i)).toBeInTheDocument(); });
  });

  it('renders table rows with client name, date, hours chip, description', async () => {
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1); });
    expect(screen.getByText('8.5 hours')).toBeInTheDocument();
    expect(screen.getByText('Development work')).toBeInTheDocument();
    expect(screen.getAllByText('Globex Inc').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10 hours')).toBeInTheDocument();
  });

  it('clicking "Add Work Entry" opens dialog with title "Add New Work Entry"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /add work entry/i }));
    await waitFor(() => { expect(screen.getByText('Add New Work Entry')).toBeInTheDocument(); });
  });

  it('form validation: submitting without selecting a client shows "Please select a client"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkEntriesPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /add work entry/i }));
    await waitFor(() => { expect(screen.getByText('Add New Work Entry')).toBeInTheDocument(); });
    // Fill hours to bypass HTML required validation, leave client unselected
    await user.type(screen.getByLabelText(/hours/i), '5');
    await user.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => { expect(screen.getByText('Please select a client')).toBeInTheDocument(); });
  });
});
