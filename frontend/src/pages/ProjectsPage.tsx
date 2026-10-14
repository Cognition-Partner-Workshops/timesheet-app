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
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  status: string;
}

const emptyFormData: ProjectFormData = {
  name: '',
  description: '',
  clientId: '',
  startDate: '',
  status: 'active',
};

const statusColors: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyFormData);
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

  const createMutation = useMutation({
    mutationFn: (projectData: { name: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string }) =>
      apiClient.createProject(projectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string } }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete project');
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiClient.deleteAllProjects(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete all projects');
    },
  });

  const projects = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id ? String(project.client_id) : '',
        startDate: project.start_date || '',
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData(emptyFormData);
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(emptyFormData);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId ? parseInt(formData.clientId) : null,
      startDate: formData.startDate || null,
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({
        id: editingProject.id,
        data: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete ALL projects? This action cannot be undone.')) {
      deleteAllMutation.mutate();
    }
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name as string]: value });
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
        <Box display="flex" gap={2}>
          {projects.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Project
          </Button>
        </Box>
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
                <TableCell>Status</TableCell>
                <TableCell>Start Date</TableCell>
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
                      {project.client_name ? (
                        <Typography variant="body2" color="text.secondary">
                          {project.client_name}
                        </Typography>
                      ) : (
                        <Chip label="Unassigned" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={project.status}
                        size="small"
                        color={statusColors[project.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {project.start_date ? (
                        <Typography variant="body2" color="text.secondary">
                          {new Date(project.start_date).toLocaleDateString()}
                        </Typography>
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
                      )}
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
                      <IconButton
                        onClick={() => handleOpen(project)}
                        color="primary"
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
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
                  <TableCell colSpan={7} align="center">
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
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="client-select-label">Client</InputLabel>
              <Select
                labelId="client-select-label"
                name="clientId"
                value={formData.clientId}
                label="Client"
                onChange={handleSelectChange}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {clients.map((client: Client) => (
                  <MenuItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel id="status-select-label">Status</InputLabel>
              <Select
                labelId="status-select-label"
                name="status"
                value={formData.status}
                label="Status"
                onChange={handleSelectChange}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Start Date"
              fullWidth
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={24} />
              ) : (
                editingProject ? 'Update' : 'Create'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
