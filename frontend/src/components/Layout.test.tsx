import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Layout from './Layout';
import { renderWithProviders, defaultAuthValue } from '../test/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children content', () => {
    renderWithProviders(
      <Layout>
        <div>Page Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('displays the app name in the sidebar', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getAllByText('Time Tracker').length).toBeGreaterThan(0);
  });

  it('renders navigation menu items', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Work Entries').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
  });

  it('displays user email', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('displays user avatar with first letter of email', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(defaultAuthValue.logout).toHaveBeenCalled();
  });

  it('navigates when menu item is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
      { initialEntries: ['/dashboard'] }
    );

    const clientsButtons = screen.getAllByText('Clients');
    await user.click(clientsButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/clients');
  });
});
