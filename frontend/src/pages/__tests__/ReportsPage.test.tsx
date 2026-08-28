import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from '../ReportsPage';
import { renderWithProviders } from '../../test/test-utils';
import { setupClientsMock, setupClientReportMock, setupEmptyClients } from '../../test/setup-api-mock';

vi.mock('../../api/client');

describe('ReportsPage', () => {
  beforeEach(() => { setupClientsMock(); setupClientReportMock(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders "Reports" heading', async () => {
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument(); });
  });

  it('when no clients exist, shows prompt to create a client', async () => {
    setupEmptyClients();
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument(); });
    expect(screen.getByRole('link', { name: /create client/i })).toBeInTheDocument();
  });

  it('when clients exist, shows the client selector dropdown', async () => {
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByRole('combobox')).toBeInTheDocument(); });
    expect(screen.getAllByText('Select Client').length).toBeGreaterThanOrEqual(1);
  });

  it('export buttons are disabled when no client is selected', async () => {
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByRole('combobox')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/export as csv/i).closest('button')).toBeDisabled();
    expect(screen.getByLabelText(/export as pdf/i).closest('button')).toBeDisabled();
  });

  it('shows "Select a client to view their time report" when no client selected', async () => {
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByText(/select a client to view their time report/i)).toBeInTheDocument(); });
  });

  it('after selecting a client, displays report cards and work entries table', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await waitFor(() => { expect(screen.getByRole('combobox')).toBeInTheDocument(); });

    await user.click(screen.getByRole('combobox'));
    const listbox = within(await screen.findByRole('listbox'));
    await user.click(listbox.getByText('Acme Corp'));

    await waitFor(() => { expect(screen.getByText('Total Hours')).toBeInTheDocument(); });
    expect(screen.getByText('Total Entries')).toBeInTheDocument();
    expect(screen.getByText('Average Hours per Entry')).toBeInTheDocument();
    expect(screen.getByText('8.00')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4.00')).toBeInTheDocument();
  });
});
