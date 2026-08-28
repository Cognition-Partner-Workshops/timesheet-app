import { screen } from '@testing-library/react';
import Layout from '../Layout';
import { renderWithProviders } from '../../test/test-utils';

describe('Layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the app bar with "Time Tracker" text', () => {
    renderWithProviders(<Layout><div>Content</div></Layout>, {
      initialEntries: ['/dashboard'],
    });

    const elements = screen.getAllByText('Time Tracker');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation items: Dashboard, Clients, Work Entries, Reports', () => {
    renderWithProviders(<Layout><div>Content</div></Layout>, {
      initialEntries: ['/dashboard'],
    });

    // Navigation items appear in both permanent and temporary drawers
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clients').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Work Entries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the logged-in user email and avatar initial', () => {
    renderWithProviders(<Layout><div>Content</div></Layout>, {
      initialEntries: ['/dashboard'],
      authContext: { user: { email: 'test@example.com', createdAt: '2024-01-01' } },
    });

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders a Logout button', () => {
    renderWithProviders(<Layout><div>Content</div></Layout>, {
      initialEntries: ['/dashboard'],
    });

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('highlights the active navigation item based on current route', () => {
    renderWithProviders(<Layout><div>Content</div></Layout>, {
      initialEntries: ['/clients'],
    });

    // The permanent drawer's ListItemButton for "Clients" should have Mui-selected class
    const allClientsTexts = screen.getAllByText('Clients');
    // Find the one inside a selected ListItemButton
    const selectedButton = allClientsTexts.find(
      (el) => el.closest('.Mui-selected') !== null
    );
    expect(selectedButton).toBeDefined();
  });
});
