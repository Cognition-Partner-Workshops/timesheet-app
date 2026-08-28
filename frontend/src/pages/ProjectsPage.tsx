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
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client, type CreateProjectRequest, type UpdateProjectRequest } from '../types/api';
import { useCrudMutations } from '../hooks/useCrudMutations';

const statusColors: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

type ProjectStatus = 'active' | 'completed' | 'on-hold';
const EMPTY_FORM = { name: '', description: '', clientId: '' as string | number, startDate: '', status: 'active' as ProjectStatus };

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');

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
    setFormData({ ...EMPTY_FORM });
    setError('');
  };

  const { createMutation, updateMutation, deleteMutation, isSaving } = useCrudMutations<CreateProjectRequest, UpdateProjectRequest>({
    queryKey: 'projects',
    createFn: (data) => apiClient.createProject(data),
    updateFn: (id, data) => apiClient.updateProject(id, data),
    deleteFn: (id) => apiClient.deleteProject(id),
    onSuccess: handleClose,
    onError: setError,
  });

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id || '',
        startDate: project.start_date || '',
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData({ ...EMPTY_FORM });
    }
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

    const payload: CreateProjectRequest = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId ? Number(formData.clientId) : null,
      startDate: formData.startDate || null,
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
                <TableCell>Start Date</TableCell>
                <TableCell>Status</TableCell>
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
                      {project.start_date ? (
                        <Typography variant="body2" color="text.secondary">
                          {new Date(project.start_date).toLocaleDateString()}
                        </Typography>
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
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
              disabled={isSaving}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="client-select-label">Client</InputLabel>
              <Select
                labelId="client-select-label"
                value={formData.clientId}
                label="Client"
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                disabled={isSaving}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {clients.map((client: Client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Start Date"
              fullWidth
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              disabled={isSaving}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="status-select-label">Status</InputLabel>
              <Select
                labelId="status-select-label"
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                disabled={isSaving}
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
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isSaving}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? <CircularProgress size={24} /> : (editingProject ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
