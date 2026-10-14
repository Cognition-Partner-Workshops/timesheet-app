import React, { useState, useCallback } from 'react';
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../api/client';
import { type Project } from '../types/api';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'success' as const },
  completed: { label: 'Completed', color: 'info' as const },
  'on-hold': { label: 'On Hold', color: 'warning' as const },
};

const INITIAL_FORM = { name: '', description: '', clientId: 0, startDate: null as Date | null, status: 'active' };

function extractApiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;
}

function NullableCell({ value, fallback = '-' }: { value: string | null | undefined; fallback?: string }) {
  if (value) return <Typography variant="body2" color="text.secondary">{value}</Typography>;
  return <Chip label={fallback} size="small" variant="outlined" />;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();
  const invalidateProjects = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    [queryClient]
  );

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditingProject(null);
    setFormData(INITIAL_FORM);
    setError('');
  }, []);

  const createMutation = useMutation({
    mutationFn: apiClient.createProject.bind(apiClient),
    onSuccess: () => { invalidateProjects(); handleClose(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof apiClient.updateProject>[1] }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => { invalidateProjects(); handleClose(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteProject.bind(apiClient),
    onSuccess: invalidateProjects,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project ? {
      name: project.name,
      description: project.description || '',
      clientId: project.client_id || 0,
      startDate: project.start_date ? new Date(project.start_date) : null,
      status: project.status,
    } : INITIAL_FORM);
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId || null,
      startDate: formData.startDate ? formData.startDate.toISOString().split('T')[0] : null,
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
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
                  projects.map((project: Project) => {
                    const statusCfg = STATUS_CONFIG[project.status] || { label: project.status, color: 'default' as const };
                    return (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography>
                        </TableCell>
                        <TableCell><NullableCell value={project.client_name} /></TableCell>
                        <TableCell>
                          {project.start_date
                            ? <Typography variant="body2">{new Date(project.start_date).toLocaleDateString()}</Typography>
                            : <Chip label="-" size="small" variant="outlined" />}
                        </TableCell>
                        <TableCell><Chip label={statusCfg.label} color={statusCfg.color} size="small" /></TableCell>
                        <TableCell><NullableCell value={project.description} fallback="No description" /></TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(project.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleOpen(project)} color="primary" size="small">
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => { if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) deleteMutation.mutate(project.id); }}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus margin="dense" label="Project Name" fullWidth required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />
              <TextField
                margin="dense" label="Description" fullWidth multiline rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSaving}
              />
              <FormControl fullWidth margin="dense">
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: Number(e.target.value) })}
                  disabled={isSaving}
                >
                  <MenuItem value={0}><em>None</em></MenuItem>
                  {clients.map((client: { id: number; name: string }) => (
                    <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ mt: 1 }}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(newValue) => setFormData({ ...formData, startDate: newValue })}
                  disabled={isSaving}
                  slotProps={{ textField: { fullWidth: true, margin: 'dense' } }}
                />
              </Box>
              <FormControl fullWidth margin="dense">
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={isSaving}
                >
                  {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={isSaving}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
