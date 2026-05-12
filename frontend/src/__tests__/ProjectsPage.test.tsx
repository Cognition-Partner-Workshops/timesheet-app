import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectsPage from '../pages/ProjectsPage';

// Mock the API client
vi.mock('../api/client', () => {
  const mockClient = {
    getProjects: vi.fn(),
    getClients: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  };
  return { default: mockClient, apiClient: mockClient };
});

import apiClient from '../api/client';

const mockedApi = vi.mocked(apiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getProjects.mockResolvedValue({ projects: [] });
    mockedApi.getClients.mockResolvedValue({ clients: [{ id: 1, name: 'Acme Corp' }] });
  });

  it('renders empty state when no projects exist', async () => {
    render(<ProjectsPage />, { wrapper: createWrapper() });
    expect(await screen.findByText(/no projects found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
  });

  it('renders the table headers correctly', async () => {
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);
    for (const header of ['Name', 'Client', 'Status', 'Start Date', 'Description', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('opens the Add Project dialog when button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    expect(screen.getByText('Add New Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
  });

  it('shows validation error when submitting with whitespace-only name', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    const nameInput = screen.getByLabelText(/project name/i);
    // Type whitespace to bypass HTML5 required validation but still trigger app-level validation
    await user.type(nameInput, '   ');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(mockedApi.createProject).not.toHaveBeenCalled();
  });

  it('calls createProject with correct data on valid submission', async () => {
    mockedApi.createProject.mockResolvedValue({
      message: 'Project created successfully',
      project: { id: 1, name: 'New Project', status: 'active' },
    });

    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    await user.type(screen.getByLabelText(/project name/i), 'New Project');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockedApi.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Project', status: 'active' })
      );
    });
  });

  it('renders projects in the table when data exists', async () => {
    mockedApi.getProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Alpha', description: 'First project', client_id: 1, client_name: 'Acme Corp', start_date: '2024-06-01', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Beta', description: null, client_id: null, client_name: null, start_date: null, status: 'on-hold', created_at: '2024-01-02', updated_at: '2024-01-02' },
      ],
    });

    render(<ProjectsPage />, { wrapper: createWrapper() });
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('on-hold')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('opens edit dialog with pre-filled data when edit icon is clicked', async () => {
    mockedApi.getProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Alpha', description: 'First project', client_id: 1, client_name: 'Acme Corp', start_date: '2024-06-01', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText('Alpha');

    const editButtons = screen.getAllByTestId('EditIcon');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toHaveValue('Alpha');
    expect(screen.getByLabelText(/description/i)).toHaveValue('First project');
  });

  it('shows confirmation dialog and calls deleteProject on delete', async () => {
    mockedApi.getProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Alpha', description: null, client_id: null, client_name: null, start_date: null, status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });
    mockedApi.deleteProject.mockResolvedValue({ message: 'Project deleted successfully' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText('Alpha');

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Alpha"?');
    await waitFor(() => {
      expect(mockedApi.deleteProject).toHaveBeenCalledWith(1);
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when confirm is cancelled', async () => {
    mockedApi.getProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Alpha', description: null, client_id: null, client_name: null, start_date: null, status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
      ],
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText('Alpha');

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteButtons[0]);

    expect(mockedApi.deleteProject).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('displays error alert when create mutation fails', async () => {
    mockedApi.createProject.mockRejectedValue({
      response: { data: { error: 'Failed to create project' } },
    });

    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    await user.type(screen.getByLabelText(/project name/i), 'Bad Project');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText('Failed to create project')).toBeInTheDocument();
  });

  it('closes the dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    expect(screen.getByText('Add New Project')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
    });
  });

  it('resets form state when dialog is reopened after cancellation', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />, { wrapper: createWrapper() });
    await screen.findByText(/no projects found/i);

    await user.click(screen.getByRole('button', { name: /add project/i }));
    await user.type(screen.getByLabelText(/project name/i), 'Temp Name');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add project/i }));
    expect(screen.getByLabelText(/project name/i)).toHaveValue('');
  });
});
