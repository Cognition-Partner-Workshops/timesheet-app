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
import apiClient from '../api/client';
import {
  type Client,
  type Project,
  type ProjectStatus,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from '../types/api';

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
];

const statusColors: Record<ProjectStatus, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

const formatDateOnly = (dateString: string) => {
  const [year, month, day] = dateString.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

const emptyForm = {
  name: '',
  description: '',
  clientId: '',
  startDate: '',
  status: 'active' as ProjectStatus,
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const makeErrorHandler = (fallback: string) => (err: unknown) => {
    const apiError = err as { response?: { data?: { error?: string } } };
    setError(apiError.response?.data?.error || fallback);
  };

  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    handleClose();
  };

  const createMutation = useMutation({
    mutationFn: (projectData: CreateProjectRequest) => apiClient.createProject(projectData),
    onSuccess: onMutationSuccess,
    onError: makeErrorHandler('Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      apiClient.updateProject(id, data),
    onSuccess: onMutationSuccess,
    onError: makeErrorHandler('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: makeErrorHandler('Failed to delete project'),
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
        clientId: String(project.client_id),
        startDate: project.start_date.slice(0, 10),
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData(emptyForm);
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(emptyForm);
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
      setError('Client is required');
      return;
    }
    if (!formData.startDate) {
      setError('Start date is required');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: Number(formData.clientId),
      startDate: formData.startDate,
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
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

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {project.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {project.client_name}
                      </Typography>
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
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateOnly(project.start_date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusOptions.find((s) => s.value === project.status)?.label || project.status}
                        size="small"
                        color={statusColors[project.status]}
                      />
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
                ))
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

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingProject ? 'Edit Project' : 'Add New Project'}
        </DialogTitle>
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
            <TextField
              margin="dense"
              label="Client"
              fullWidth
              required
              select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              disabled={isSaving}
            >
              {clients.map((client) => (
                <MenuItem key={client.id} value={String(client.id)}>
                  {client.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              margin="dense"
              label="Start Date"
              fullWidth
              required
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              disabled={isSaving}
            />
            <TextField
              margin="dense"
              label="Status"
              fullWidth
              select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              disabled={isSaving}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
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
  );
};

export default ProjectsPage;
