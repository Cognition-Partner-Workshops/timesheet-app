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
  Chip,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Client, type Project, type ProjectStatus, type UpdateProjectRequest } from '../types/api';

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

const apiErrorMessage = (err: unknown, fallback: string): string => {
  const error = err as { response?: { data?: { error?: string } } };
  return error.response?.data?.error || fallback;
};

const emptyForm = { name: '', description: '', clientId: '', startDate: '', status: 'active' as ProjectStatus };

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

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(emptyForm);
    setError('');
  };

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    handleClose();
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: UpdateProjectRequest & { name: string } }) =>
      id === null ? apiClient.createProject(data) : apiClient.updateProject(id, data),
    onSuccess: onSaved,
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to save project')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to delete project')),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const busy = saveMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project || null);
    setFormData(
      project
        ? {
            name: project.name,
            description: project.description || '',
            clientId: project.client_id ? String(project.client_id) : '',
            startDate: project.start_date || '',
            status: project.status,
          }
        : emptyForm
    );
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    saveMutation.mutate({
      id: editingProject ? editingProject.id : null,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        clientId: formData.clientId ? Number(formData.clientId) : null,
        startDate: formData.startDate || null,
        status: formData.status,
      },
    });
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
                {['Name', 'Client', 'Status', 'Start Date', 'Description'].map((label) => (
                  <TableCell key={label}>{label}</TableCell>
                ))}
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
                      {project.client_name || <Chip label="Unassigned" size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusOptions.find((s) => s.value === project.status)?.label || project.status}
                        size="small"
                        color={statusColors[project.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {project.description || <Chip label="No description" size="small" variant="outlined" />}
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
              disabled={busy}
            />
            <TextField
              margin="dense"
              label="Client"
              fullWidth
              select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              disabled={busy}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
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
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              disabled={busy}
            />
            <TextField
              margin="dense"
              label="Status"
              fullWidth
              select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              disabled={busy}
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
              disabled={busy}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? <CircularProgress size={24} /> : editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
