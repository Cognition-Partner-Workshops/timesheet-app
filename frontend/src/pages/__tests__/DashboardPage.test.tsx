import { screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import { setupClientsMock, setupWorkEntriesMock, setupEmptyWorkEntries } from '../../test/setup-api-mock';

vi.mock('../../api/client');

describe('DashboardPage', () => {
  beforeEach(() => {
    setupClientsMock();
    setupWorkEntriesMock();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('shows "Dashboard" heading', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders three stat cards: Total Clients, Total Work Entries, Total Hours', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => { expect(screen.getByText('Total Clients')).toBeInTheDocument(); });
    expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
    expect(screen.getByText('Total Hours')).toBeInTheDocument();
  });

  it('displays correct counts from mocked API data', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => { expect(screen.getByText('3')).toBeInTheDocument(); });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('42.50')).toBeInTheDocument();
  });

  it('shows "No work entries yet" when work entries list is empty', async () => {
    setupEmptyWorkEntries();
    renderWithProviders(<DashboardPage />);
    await waitFor(() => { expect(screen.getByText('No work entries yet')).toBeInTheDocument(); });
  });

  it('shows recent work entries with client name, hours, date', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => { expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1); });
    expect(screen.getByText(/8\.5 hours/)).toBeInTheDocument();
  });

  it('Quick Actions section has "Add Client", "Add Work Entry", "View Reports" buttons', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
  });
});
