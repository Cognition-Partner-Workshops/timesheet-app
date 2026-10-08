import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import {
  useCreateProject,
  useDeleteProject,
  useProjectClients,
  useProjects,
  useUpdateProject,
} from '../hooks/useProjects';
import { type Client, type Project, type ProjectStatus } from '../types/api';

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: 'success' | 'primary' | 'warning' }[] = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'primary' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
];

const getStatusOption = (status: ProjectStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];

interface ProjectFormData {
  name: string;
  description: string;
  clientId: number;
  startDate: Date | null;
  status: ProjectStatus;
}

const emptyForm = (): ProjectFormData => ({
  name: '',
  description: '',
  clientId: 0,
  startDate: new Date(),
  status: 'active',
});

const getErrorMessage = (err: unknown, fallback: string) => {
  const error = err as { response?: { data?: { error?: string } } };
  return error.response?.data?.error || fallback;
};

const getProjectFormValidationError = (formData: ProjectFormData) => {
  if (!formData.name.trim()) {
    return 'Project name is required';
  }

  if (!formData.clientId) {
    return 'Please select a client';
  }

  return '';
};

interface ProjectsTableBodyProps {
  projects: Project[];
  statusFilter: ProjectStatus | '';
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  isDeletePending: boolean;
}

const ProjectsTableBody: React.FC<ProjectsTableBodyProps> = ({
  projects,
  statusFilter,
  onEdit,
  onDelete,
  isDeletePending,
}) => {
  if (projects.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={6} align="center">
            <Typography color="text.secondary" sx={{ py: 3 }}>
              {statusFilter
                ? 'No projects match the selected status.'
                : 'No projects found. Create your first project to get started.'}
            </Typography>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {projects.map((project) => {
        const statusOption = getStatusOption(project.status);
        return (
          <TableRow key={project.id}>
            <TableCell>
              <Typography variant="subtitle1" fontWeight="medium">
                {project.name}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{project.client_name}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">
                {parseISO(project.start_date).toLocaleDateString()}
              </Typography>
            </TableCell>
            <TableCell>
              <Chip label={statusOption.label} color={statusOption.color} size="small" />
            </TableCell>
            <TableCell>
              {project.description ? (
                <Typography variant="body2" color="text.secondary">
                  {project.description}
                </Typography>
              ) : (
                <Chip label="No description" size="small" variant="outlined" />
              )}
            </TableCell>
            <TableCell align="right">
              <IconButton
                onClick={() => onEdit(project)}
                color="primary"
                size="small"
                aria-label={`Edit ${project.name}`}
              >
                <EditIcon />
              </IconButton>
              <IconButton
                onClick={() => onDelete(project)}
                color="error"
                size="small"
                aria-label={`Delete ${project.name}`}
                disabled={isDeletePending}
              >
                <DeleteIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
};

interface ProjectsContentProps {
  clients: Client[];
  projects: Project[];
  clientsError: boolean;
  projectsError: boolean;
  statusFilter: ProjectStatus | '';
  refetchClients: () => Promise<unknown>;
  refetchProjects: () => Promise<unknown>;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  isDeletePending: boolean;
}

const ProjectsContent: React.FC<ProjectsContentProps> = ({
  clients,
  projects,
  clientsError,
  projectsError,
  statusFilter,
  refetchClients,
  refetchProjects,
  onEdit,
  onDelete,
  isDeletePending,
}) => {
  if (clientsError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetchClients()}>
            Retry
          </Button>
        }
      >
        Failed to load clients.
      </Alert>
    );
  }

  if (clients.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          You need to create at least one client before adding projects.
        </Typography>
        <Button variant="contained" href="/clients">
          Create Client
        </Button>
      </Paper>
    );
  }

  if (projectsError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetchProjects()}>
            Retry
          </Button>
        }
      >
        Failed to load projects.
      </Alert>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <ProjectsTableBody
            projects={projects}
            statusFilter={statusFilter}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeletePending={isDeletePending}
          />
        </Table>
      </TableContainer>
    </Paper>
  );
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [error, setError] = useState('');

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects(statusFilter ? { status: statusFilter } : {});
  const {
    data: clients = [],
    isLoading: clientsLoading,
    isError: clientsError,
    refetch: refetchClients,
  } = useProjectClients();

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id,
        startDate: parseISO(project.start_date),
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData(emptyForm());
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(emptyForm());
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = getProjectFormValidationError(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!formData.startDate || Number.isNaN(formData.startDate.getTime())) {
      setError('Please select a valid start date');
      return;
    }

    const projectData = {
      name: formData.name,
      description: formData.description,
      clientId: formData.clientId,
      startDate: format(formData.startDate, 'yyyy-MM-dd'),
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate(
        { id: editingProject.id, data: projectData },
        {
          onSuccess: handleClose,
          onError: (err) => setError(getErrorMessage(err, 'Failed to update project')),
        }
      );
    } else {
      createMutation.mutate(
        { ...projectData, description: projectData.description || undefined },
        {
          onSuccess: handleClose,
          onError: (err) => setError(getErrorMessage(err, 'Failed to create project')),
        }
      );
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id, {
        onError: (err) => setError(getErrorMessage(err, 'Failed to delete project')),
      });
    }
  };

  const submitButtonLabel = editingProject ? 'Update' : 'Create';

  if (projectsLoading || clientsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Projects</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="project-status-filter-label">Status</InputLabel>
              <Select
                labelId="project-status-filter-label"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
              >
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpen()}
              disabled={clientsError || clients.length === 0}
            >
              Add Project
            </Button>
          </Box>
        </Box>

        {error && !open && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <ProjectsContent
          clients={clients}
          projects={projects}
          clientsError={clientsError}
          projectsError={projectsError}
          statusFilter={statusFilter}
          refetchClients={refetchClients}
          refetchProjects={refetchProjects}
          onEdit={handleOpen}
          onDelete={handleDelete}
          isDeletePending={deleteMutation.isPending}
        />

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                autoFocus
                margin="dense"
                label="Project Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />

              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-client-label">Client</InputLabel>
                <Select
                  labelId="project-client-label"
                  label="Client"
                  value={formData.clientId || ''}
                  onChange={(e) => setFormData({ ...formData, clientId: Number(e.target.value) })}
                  disabled={isSaving}
                >
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <DatePicker
                label="Start Date"
                value={formData.startDate}
                onChange={(date) => setFormData({ ...formData, startDate: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'dense',
                    required: true,
                    disabled: isSaving,
                  },
                }}
              />

              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-status-label">Status</InputLabel>
                <Select
                  labelId="project-status-label"
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                  disabled={isSaving}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                margin="dense"
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSaving}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSaving}>
                {isSaving ? <CircularProgress size={24} /> : submitButtonLabel}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
