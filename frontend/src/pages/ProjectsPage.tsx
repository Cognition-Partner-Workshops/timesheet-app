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
  type SelectChangeEvent,
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
import { type Project } from '../types/api';

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientId: 0,
    startDate: null as Date | null,
    endDate: null as Date | null,
    status: 'active' as string,
    budgetHours: '',
  });
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClientId, setFilterClientId] = useState(0);

  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', filterStatus, filterClientId],
    queryFn: () =>
      apiClient.getProjects({
        status: filterStatus || undefined,
        clientId: filterClientId || undefined,
      }),
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      clientId: number;
      startDate?: string | null;
      endDate?: string | null;
      status?: string;
      budgetHours?: number | null;
    }) => apiClient.createProject(data),
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
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        name?: string;
        description?: string;
        clientId?: number;
        startDate?: string | null;
        endDate?: string | null;
        status?: string;
        budgetHours?: number | null;
      };
    }) => apiClient.updateProject(id, data),
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

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id,
        startDate: project.start_date ? new Date(project.start_date) : null,
        endDate: project.end_date ? new Date(project.end_date) : null,
        status: project.status,
        budgetHours: project.budget_hours != null ? project.budget_hours.toString() : '',
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        description: '',
        clientId: 0,
        startDate: null,
        endDate: null,
        status: 'active',
        budgetHours: '',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      clientId: 0,
      startDate: null,
      endDate: null,
      status: 'active',
      budgetHours: '',
    });
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

    const projectData = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId,
      startDate: formData.startDate ? formData.startDate.toISOString().split('T')[0] : null,
      endDate: formData.endDate ? formData.endDate.toISOString().split('T')[0] : null,
      status: formData.status,
      budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : null,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: projectData });
    } else {
      createMutation.mutate(projectData);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"? Work entries linked to this project will be unlinked.`)) {
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
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box display="flex" gap={2}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    label="Status"
                    onChange={(e: SelectChangeEvent) => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="on-hold">On Hold</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Client</InputLabel>
                  <Select
                    value={filterClientId.toString()}
                    label="Client"
                    onChange={(e: SelectChangeEvent) => setFilterClientId(Number(e.target.value))}
                  >
                    <MenuItem value="0">All Clients</MenuItem>
                    {clients.map((c: { id: number; name: string }) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Paper>

            <Paper>
              <TableContainer>
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
                    {projects.length > 0 ? (
                      projects.map((project: Project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {project.name}
                            </Typography>
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
                          <TableCell>
                            {project.start_date
                              ? new Date(project.start_date).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {project.end_date
                              ? new Date(project.end_date).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {project.budget_hours != null ? project.budget_hours : '—'}
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
                            No projects found. Add your first project to get started.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

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
              <TextField
                margin="dense"
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
              <FormControl fullWidth margin="dense" required>
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: Number(e.target.value) })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {clients.map((c: { id: number; name: string }) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box display="flex" gap={2} mt={1}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(date) => setFormData({ ...formData, startDate: date })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  slotProps={{ textField: { fullWidth: true, margin: 'dense' } }}
                />
                <DatePicker
                  label="End Date"
                  value={formData.endDate}
                  onChange={(date) => setFormData({ ...formData, endDate: date })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  slotProps={{ textField: { fullWidth: true, margin: 'dense' } }}
                />
              </Box>
              <Box display="flex" gap={2} mt={1}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="on-hold">On Hold</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  margin="dense"
                  label="Budget Hours"
                  type="number"
                  fullWidth
                  value={formData.budgetHours}
                  onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingProject
                    ? 'Update'
                    : 'Create'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
