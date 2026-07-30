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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import LoadingState from '../components/LoadingState';
import { type Client, type Project } from '../types/api';

const emptyForm = { clientId: 0, name: '', description: '' };

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

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const onMutationError = (fallback: string) => (err: unknown) => {
    const error = err as { response?: { data?: { error?: string } } };
    setError(error.response?.data?.error || fallback);
  };

  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const createMutation = useMutation({
    mutationFn: (projectData: { clientId: number; name: string; description?: string }) =>
      apiClient.createProject(projectData),
    onSuccess: () => {
      invalidateProjects();
      handleClose();
    },
    onError: onMutationError('Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { clientId?: number; name?: string; description?: string } }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => {
      invalidateProjects();
      handleClose();
    },
    onError: onMutationError('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: invalidateProjects,
    onError: onMutationError('Failed to delete project'),
  });

  const projects = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const clientName = (clientId: number) =>
    clients.find((client) => client.id === clientId)?.name || '-';

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        clientId: project.client_id,
        name: project.name,
        description: project.description || '',
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

    if (!formData.clientId) {
      setError('Please select a client');
      return;
    }

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    const projectData = {
      clientId: formData.clientId,
      name: formData.name,
      description: formData.description || undefined,
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

  if (isLoading || clientsLoading) {
    return <LoadingState />;
  }

  return (
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
                  <TableCell>Description</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.length > 0 ? (
                  projects.map((project: Project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {project.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {clientName(project.client_id)}
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
                          {new Date(project.created_at).toLocaleDateString()}
                        </Typography>
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
                    <TableCell colSpan={5} align="center">
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
            <FormControl fullWidth margin="dense" required>
              <InputLabel>Client</InputLabel>
              <Select
                value={formData.clientId}
                label="Client"
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
