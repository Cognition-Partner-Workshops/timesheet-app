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
  FormControl,
  InputLabel,
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
  status: string;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

const STATUS_COLORS: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success', completed: 'default', 'on-hold': 'warning',
};

function extractApiError(err: unknown, fallback: string): string {
  const typed = err as { response?: { data?: { error?: string } } };
  return typed.response?.data?.error || fallback;
}

function OptionalCell({ value, fallback = '-' }: { value: string | null; fallback?: string }) {
  return value
    ? <Typography variant="body2" color="text.secondary">{value}</Typography>
    : <Chip label={fallback} size="small" variant="outlined" />;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(EMPTY_FORM);
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
    setFormData(EMPTY_FORM);
    setError('');
  };

  const invalidateAndClose = () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; clientId?: number | null; startDate?: string; status?: string }) =>
      apiClient.createProject(data),
    onSuccess: invalidateAndClose,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; clientId?: number | null; startDate?: string; status?: string } }) =>
      apiClient.updateProject(id, data),
    onSuccess: invalidateAndClose,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const saving = createMutation.isPending || updateMutation.isPending;

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
      setFormData(EMPTY_FORM);
    }
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
      clientId: formData.clientId ? Number(formData.clientId) : null,
      startDate: formData.startDate || undefined,
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

  const handleSelectChange = (e: SelectChangeEvent) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setField = (field: keyof ProjectFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
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
              {projects.length > 0 ? projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography>
                  </TableCell>
                  <TableCell><OptionalCell value={project.client_name} /></TableCell>
                  <TableCell>
                    <OptionalCell value={project.start_date ? new Date(project.start_date).toLocaleDateString() : null} />
                  </TableCell>
                  <TableCell>
                    <Chip label={project.status} size="small" color={STATUS_COLORS[project.status] || 'default'} />
                  </TableCell>
                  <TableCell><OptionalCell value={project.description} fallback="No description" /></TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(project.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(project)} color="error" size="small"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
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
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required
              value={formData.name} onChange={setField('name')} disabled={saving} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="client-select-label">Client</InputLabel>
              <Select labelId="client-select-label" name="clientId" value={formData.clientId}
                label="Client" onChange={handleSelectChange} disabled={saving}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" fullWidth type="date"
              value={formData.startDate} onChange={setField('startDate')} disabled={saving}
              slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="status-select-label">Status</InputLabel>
              <Select labelId="status-select-label" name="status" value={formData.status}
                label="Status" onChange={handleSelectChange} disabled={saving}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={setField('description')} disabled={saving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={24} /> : (editingProject ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
