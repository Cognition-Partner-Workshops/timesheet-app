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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../api/client';
import {
  type Client,
  type Project,
  type ProjectStatus,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from '../types/api';

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: 'success' | 'default' | 'warning' }[] = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
];

const emptyForm = {
  name: '',
  description: '',
  clientId: 0,
  startDate: new Date() as Date | null,
  status: 'active' as ProjectStatus,
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const onMutationError = (fallback: string) => (err: unknown) => {
    const error = err as { response?: { data?: { error?: string } } };
    setError(error.response?.data?.error || fallback);
  };

  const onMutationSuccess = (closeDialog: boolean) => () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    if (closeDialog) {
      handleClose();
    }
  };

  const createMutation = useMutation({
    mutationFn: (projectData: CreateProjectRequest) => apiClient.createProject(projectData),
    onSuccess: onMutationSuccess(true),
    onError: onMutationError('Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      apiClient.updateProject(id, data),
    onSuccess: onMutationSuccess(true),
    onError: onMutationError('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: onMutationSuccess(false),
    onError: onMutationError('Failed to delete project'),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id,
        startDate: new Date(project.start_date),
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData({ ...emptyForm, startDate: new Date() });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData({ ...emptyForm, startDate: new Date() });
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!formData.clientId) {
      setError('Please select a client');
      return;
    }

    if (!formData.startDate) {
      setError('Please select a start date');
      return;
    }

    const projectData = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId,
      startDate: formData.startDate.toISOString().split('T')[0],
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: projectData });
    } else {
      createMutation.mutate(projectData);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Project
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {clients.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              You need to create at least one client before adding projects.
            </Typography>
            <Button variant="contained" href="/clients">
              Create Client
            </Button>
          </Paper>
        ) : (
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
                    projects.map((project) => {
                      const status = STATUS_OPTIONS.find((option) => option.value === project.status);

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
                              {new Date(project.start_date).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={status?.label || project.status}
                              color={status?.color || 'default'}
                              size="small"
                            />
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
                            <IconButton onClick={() => handleOpen(project)} color="primary" size="small">
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => handleDelete(project)} color="error" size="small">
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          No projects found. Create your first project to get started.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
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
                  value={formData.clientId}
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
                    margin: 'dense',
                    fullWidth: true,
                    required: true,
                  },
                }}
                disabled={isSaving}
              />

              <FormControl fullWidth margin="dense">
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
                {isSaving ? <CircularProgress size={24} /> : editingProject ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
