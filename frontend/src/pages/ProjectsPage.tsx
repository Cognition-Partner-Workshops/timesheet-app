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
  type SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'on-hold';
  budgetHours: string;
}

const emptyForm: ProjectFormData = {
  name: '',
  description: '',
  clientId: '',
  startDate: '',
  endDate: '',
  status: 'active',
  budgetHours: '',
};

const statusColors: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyForm);
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
    mutationFn: (data: { name: string; description?: string; clientId: number; startDate?: string | null; endDate?: string | null; status?: 'active' | 'completed' | 'on-hold'; budgetHours?: number | null }) =>
      apiClient.createProject(data),
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
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; clientId?: number; startDate?: string | null; endDate?: string | null; status?: 'active' | 'completed' | 'on-hold'; budgetHours?: number | null } }) =>
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

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: String(project.client_id),
        startDate: project.start_date || '',
        endDate: project.end_date || '',
        status: project.status,
        budgetHours: project.budget_hours != null ? String(project.budget_hours) : '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: parseInt(formData.clientId),
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      status: formData.status as 'active' | 'completed' | 'on-hold',
      budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : null,
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No projects yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Click "Add Project" to create your first project
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Budget Hours</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Typography fontWeight="medium">{project.name}</Typography>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary">
                        {project.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{project.client_name}</TableCell>
                  <TableCell>
                    <Chip
                      label={project.status}
                      color={statusColors[project.status] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{project.start_date || '-'}</TableCell>
                  <TableCell>{project.end_date || '-'}</TableCell>
                  <TableCell>{project.budget_hours != null ? project.budget_hours : '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      onClick={() => handleOpen(project)}
                      aria-label={`Edit ${project.name}`}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(project)}
                      aria-label={`Delete ${project.name}`}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              name="name"
              label="Project Name"
              fullWidth
              required
              value={formData.name}
              onChange={handleChange}
            />
            <TextField
              margin="dense"
              name="description"
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={handleChange}
            />
            <FormControl fullWidth margin="dense" required>
              <InputLabel id="client-select-label">Client</InputLabel>
              <Select
                labelId="client-select-label"
                name="clientId"
                value={formData.clientId}
                label="Client"
                onChange={handleSelectChange}
              >
                {clients.map((client) => (
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
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              name="startDate"
              label="Start Date"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.startDate}
              onChange={handleChange}
            />
            <TextField
              margin="dense"
              name="endDate"
              label="End Date"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.endDate}
              onChange={handleChange}
            />
            <TextField
              margin="dense"
              name="budgetHours"
              label="Budget Hours"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              value={formData.budgetHours}
              onChange={handleChange}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
