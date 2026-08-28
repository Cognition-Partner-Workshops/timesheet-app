import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import ProjectsPage from '../ProjectsPage';

// Mock the API client
vi.mock('../../api/client', () => ({
  default: {
    getProjects: vi.fn(),
    getClients: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    deleteAllProjects: vi.fn(),
  },
}));

import apiClient from '../../api/client';

const mockedApiClient = vi.mocked(apiClient);

const mockProjects = [
  {
    id: 1,
    name: 'Project Alpha',
    description: 'Alpha description',
    client_id: 1,
    start_date: '2024-01-15',
    end_date: '2024-06-30',
    status: 'active' as const,
    client_name: 'Acme Corp',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Project Beta',
    description: null,
    client_id: null,
    start_date: null,
    end_date: null,
    status: 'completed' as const,
    client_name: null,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Project Gamma',
    description: 'On hold project',
    client_id: 2,
    start_date: '2024-03-01',
    end_date: null,
    status: 'on-hold' as const,
    client_name: 'Beta Inc',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
  },
];

const mockClients = [
  { id: 1, name: 'Acme Corp', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, name: 'Beta Inc', description: null, department: null, email: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    ),
    queryClient,
  };
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.getProjects.mockResolvedValue({ projects: mockProjects });
    mockedApiClient.getClients.mockResolvedValue({ clients: mockClients });
    mockedApiClient.createProject.mockResolvedValue({ message: 'Project created successfully', project: mockProjects[0] });
    mockedApiClient.updateProject.mockResolvedValue({ message: 'Project updated successfully', project: mockProjects[0] });
    mockedApiClient.deleteProject.mockResolvedValue({ message: 'Project deleted successfully' });
    mockedApiClient.deleteAllProjects.mockResolvedValue({ message: 'All projects deleted successfully', deletedCount: 3 });
  });

  describe('Loading and rendering', () => {
    test('should show loading spinner while fetching data', () => {
      mockedApiClient.getProjects.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithProviders(<ProjectsPage />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('should render page title', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });
    });

    test('should render Add Project button', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });
    });

    test('should show empty state when no projects exist', async () => {
      mockedApiClient.getProjects.mockResolvedValue({ projects: [] });
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
      });
    });

    test('should not show Clear All button when no projects exist', async () => {
      mockedApiClient.getProjects.mockResolvedValue({ projects: [] });
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });
  });

  describe('Projects table', () => {
    test('should display project names in the table', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });

    test('should display client names for assigned projects', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Beta Inc')).toBeInTheDocument();
      });
    });

    test('should display Unassigned chip for projects without client', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Unassigned')).toBeInTheDocument();
      });
    });

    test('should display status chips with correct labels', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('on-hold')).toBeInTheDocument();
      });
    });

    test('should display project description', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Alpha description')).toBeInTheDocument();
      });
    });

    test('should display No description chip for projects without description', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('No description')).toBeInTheDocument();
      });
    });

    test('should render table headers including End Date', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Client')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Start Date')).toBeInTheDocument();
        expect(screen.getByText('End Date')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    test('should show Clear All button when projects exist', async () => {
      renderWithProviders(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });
    });
  });

  describe('Create project dialog', () => {
    test('should open Add New Project dialog when Add Project button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      expect(screen.getByText('Add New Project')).toBeInTheDocument();
    });

    test('should show form fields in create dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });

    test('should show Create button in create dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    test('should show Cancel button in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    test('should not call API when submitting without name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.click(screen.getByRole('button', { name: /create/i }));

      // API should not be called when name is empty
      expect(mockedApiClient.createProject).not.toHaveBeenCalled();

      // Dialog should remain open (not closed by handleClose which is only called onSuccess)
      expect(screen.getByText('Add New Project')).toBeInTheDocument();
    });

    test('should call createProject API when form is submitted with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      await user.type(screen.getByLabelText(/project name/i), 'New Project');

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockedApiClient.createProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'New Project' })
        );
      });
    });

    test('should close dialog after successful creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'New Project');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
      });
    });

    test('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      expect(screen.getByText('Add New Project')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
      });
    });

    test('should show error when API returns error on create', async () => {
      mockedApiClient.createProject.mockRejectedValue({
        response: { data: { error: 'Project dates overlap with existing project "Project Alpha" for the same client' } },
      });

      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Overlapping Project');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/overlap/i)).toBeInTheDocument();
      });
    });
  });

  describe('Date validation', () => {
    test('should show error when end date is before start date on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Test Project');

      // Use fireEvent.change for date inputs since userEvent.type doesn't work with type="date"
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-01-01' } });

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        // Error may be shown in alert (aria-hidden behind dialog) or as helperText
        expect(document.body.textContent).toContain('End date must not be before start date');
      });
    });

    test('should not call API when end date is before start date', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Test Project');

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-01-01' } });

      await user.click(screen.getByRole('button', { name: /create/i }));

      expect(mockedApiClient.createProject).not.toHaveBeenCalled();
    });

    test('should show inline helper text on end date field when dates are invalid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-01-01' } });

      // The helper text should appear on the End Date field
      await waitFor(() => {
        const helperTexts = screen.getAllByText('End date must not be before start date');
        expect(helperTexts.length).toBeGreaterThan(0);
      });
    });

    test('should allow submission when end date equals start date', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Same Day Project');

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-06-01' } });

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockedApiClient.createProject).toHaveBeenCalled();
      });
    });

    test('should allow submission when only start date is provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Open End Project');

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockedApiClient.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Open End Project',
            startDate: '2024-06-01',
          })
        );
      });
    });
  });

  describe('Edit project dialog', () => {
    test('should open Edit Project dialog when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      // Find the row for Project Alpha and click its edit button
      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      expect(alphaRow).toBeTruthy();

      const editButtons = within(alphaRow!).getAllByRole('button');
      const editButton = editButtons.find(btn => btn.querySelector('[data-testid="EditIcon"]'));
      if (editButton) {
        await user.click(editButton);
      } else {
        // Fallback: click the first icon button (edit)
        await user.click(editButtons[0]);
      }

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });
    });

    test('should pre-fill form with project data when editing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const editButtons = within(alphaRow!).getAllByRole('button');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/project name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Project Alpha');
    });

    test('should show Update button in edit dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const editButtons = within(alphaRow!).getAllByRole('button');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
      });
    });

    test('should call updateProject API when editing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const editButtons = within(alphaRow!).getAllByRole('button');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Alpha');
      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(mockedApiClient.updateProject).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ name: 'Updated Alpha' })
        );
      });
    });

    test('should show error when API returns error on update', async () => {
      mockedApiClient.updateProject.mockRejectedValue({
        response: { data: { error: 'Project dates overlap with existing project "Project Gamma" for the same client' } },
      });

      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const editButtons = within(alphaRow!).getAllByRole('button');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(screen.getByText(/overlap/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete project', () => {
    test('should call deleteProject when confirmed', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const buttons = within(alphaRow!).getAllByRole('button');
      // Delete button is the second icon button
      await user.click(buttons[1]);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete "Project Alpha"?');
      expect(mockedApiClient.deleteProject).toHaveBeenCalledWith(1);
    });

    test('should not call deleteProject when cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find(row => within(row).queryByText('Project Alpha'));
      const buttons = within(alphaRow!).getAllByRole('button');
      await user.click(buttons[1]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApiClient.deleteProject).not.toHaveBeenCalled();
    });
  });

  describe('Delete all projects', () => {
    test('should call deleteAllProjects when confirmed', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete ALL projects? This action cannot be undone.');
      expect(mockedApiClient.deleteAllProjects).toHaveBeenCalled();
    });

    test('should not call deleteAllProjects when cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApiClient.deleteAllProjects).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should show generic error on create failure without error details', async () => {
      mockedApiClient.createProject.mockRejectedValue({ response: {} });

      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Failing Project');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to create project')).toBeInTheDocument();
      });
    });

    test('should clear error when dialog is closed', async () => {
      mockedApiClient.createProject.mockRejectedValue({ response: {} });

      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add project/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add project/i }));
      await user.type(screen.getByLabelText(/project name/i), 'Failing Project');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to create project')).toBeInTheDocument();
      });

      // Closing the dialog should clear the error
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Failed to create project')).not.toBeInTheDocument();
      });
    });
  });
});
