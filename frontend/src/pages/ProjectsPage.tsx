import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import apiClient from '../api/client';
import type {
  Client,
  CreateProjectRequest,
  Project,
  ProjectFilters,
  ProjectStatus,
  UpdateProjectRequest
} from '../types/api';

interface ProjectFormData {
  name: string;
  clientId: number | '';
  startDate: Date | null;
  status: ProjectStatus;
  description: string;
}

const createInitialFormData = (): ProjectFormData => ({
  name: '',
  clientId: '',
  startDate: new Date(),
  status: 'active',
  description: ''
});

const statusDisplay: Record<ProjectStatus, {
  label: string;
  color: 'success' | 'primary' | 'warning';
}> = {
  active: { label: 'Active', color: 'success' },
  completed: { label: 'Completed', color: 'primary' },
  'on-hold': { label: 'On Hold', color: 'warning' }
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = error as { response?: { data?: { error?: string } } };
  return apiError.response?.data?.error || fallback;
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(createInitialFormData);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [clientFilter, setClientFilter] = useState<number | ''>('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const filters: ProjectFilters = {};
  if (clientFilter !== '') {
    filters.clientId = clientFilter;
  }
  if (statusFilter) {
    filters.status = statusFilter;
  }

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => apiClient.getProjects(filters)
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients()
  });

  const clients: Client[] = clientsData?.clients || [];
  const projects = projectsData?.projects || [];

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(createInitialFormData());
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (mutationError: unknown) => {
      setError(getErrorMessage(mutationError, 'Failed to create project'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (mutationError: unknown) => {
      setError(getErrorMessage(mutationError, 'Failed to update project'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (mutationError: unknown) => {
      setError(getErrorMessage(mutationError, 'Failed to delete project'));
    }
  });

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        clientId: project.client_id,
        startDate: parseISO(project.start_date),
        status: project.status,
        description: project.description || ''
      });
    } else {
      setEditingProject(null);
      setFormData(createInitialFormData());
    }
    setError('');
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (formData.clientId === '') {
      setError('Client is required');
      return;
    }

    if (!formData.startDate) {
      setError('Start date is required');
      return;
    }

    const data = {
      name: formData.name,
      description: formData.description,
      clientId: formData.clientId,
      startDate: format(formData.startDate, 'yyyy-MM-dd'),
      status: formData.status
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const isLoading = projectsLoading || clientsLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
            disabled={clients.length === 0}
          >
            Add Project
          </Button>
        </Box>

        {clients.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Create a client first before adding projects.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box display="flex" gap={2} mb={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="project-status-filter-label">Status</InputLabel>
            <Select
              labelId="project-status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ProjectStatus | '')}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="project-client-filter-label">Client</InputLabel>
            <Select
              labelId="project-client-filter-label"
              label="Client"
              value={clientFilter}
              onChange={(event) => {
                const value = event.target.value;
                setClientFilter(String(value) === '' ? '' : Number(value));
              }}
            >
              <MenuItem value="">All clients</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

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
              <TableBody>
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{project.client_name}</TableCell>
                      <TableCell>{format(parseISO(project.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Chip
                          label={statusDisplay[project.status].label}
                          color={statusDisplay[project.status].color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{project.description || '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Edit ${project.name}`}
                          onClick={() => handleOpen(project)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          aria-label={`Delete ${project.name}`}
                          onClick={() => handleDelete(project)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        No projects found. Add your first project to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Name"
                fullWidth
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                disabled={isSubmitting}
              />
              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-form-client-label">Client</InputLabel>
                <Select
                  labelId="project-form-client-label"
                  label="Client"
                  value={formData.clientId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormData({
                      ...formData,
                      clientId: String(value) === '' ? '' : Number(value)
                    });
                  }}
                  disabled={isSubmitting}
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
                onChange={(startDate) => setFormData({ ...formData, startDate })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'dense',
                    required: true,
                    disabled: isSubmitting
                  }
                }}
              />
              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-form-status-label">Status</InputLabel>
                <Select
                  labelId="project-form-status-label"
                  label="Status"
                  value={formData.status}
                  onChange={(event) => setFormData({
                    ...formData,
                    status: event.target.value as ProjectStatus
                  })}
                  disabled={isSubmitting}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on-hold">On Hold</MenuItem>
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                disabled={isSubmitting}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
