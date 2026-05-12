import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientsPage from '../ClientsPage';
import { renderWithProviders } from '../../test/test-utils';
import { setupClientsMock, setupEmptyClients, setupPendingClients } from '../../test/setup-api-mock';

vi.mock('../../api/client');

describe('ClientsPage', () => {
  beforeEach(() => { setupClientsMock(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders "Clients" heading and "Add Client" button', async () => {
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByRole('heading', { name: /clients/i })).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
  });

  it('shows loading spinner while data fetches', () => {
    setupPendingClients();
    renderWithProviders(<ClientsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows "No clients found" empty state when clients list is empty', async () => {
    setupEmptyClients();
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByText(/no clients found/i)).toBeInTheDocument(); });
  });

  it('renders a table with client data', async () => {
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByText('Acme Corp')).toBeInTheDocument(); });
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('contact@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Main client')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
  });

  it('clicking "Add Client" opens dialog with "Add New Client" title', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /add client/i }));
    await waitFor(() => { expect(screen.getByText('Add New Client')).toBeInTheDocument(); });
  });

  it('clicking edit icon opens dialog with "Edit Client" title and pre-filled form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByText('Acme Corp')).toBeInTheDocument(); });
    const editButtons = screen.getAllByTestId('EditIcon');
    await user.click(editButtons[0].closest('button')!);
    await waitFor(() => { expect(screen.getByText('Edit Client')).toBeInTheDocument(); });
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
  });

  it('shows "Clear All" button only when clients exist', async () => {
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument(); });
  });

  it('does not show "Clear All" button when no clients exist', async () => {
    setupEmptyClients();
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByText(/no clients found/i)).toBeInTheDocument(); });
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('form validation: submitting with empty name shows "Client name is required"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientsPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /add client/i }));
    await waitFor(() => { expect(screen.getByText('Add New Client')).toBeInTheDocument(); });
    // Type a space so HTML required is satisfied but trim() check fails
    await user.type(screen.getByLabelText(/client name/i), ' ');
    await user.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => { expect(screen.getByText('Client name is required')).toBeInTheDocument(); });
  });
});
