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
import { type Project, type CreateProjectRequest } from '../types/api';

type ProjectStatus = 'active' | 'completed' | 'on-hold';
const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: 'success' | 'default' | 'warning' }[] = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
];

const EMPTY_FORM = { name: '', description: '', clientId: 0, startDate: '', endDate: '', status: 'active' as ProjectStatus, budgetHours: '' };

function extractApiError(err: unknown, fallback: string): string {
  const typed = err as { response?: { data?: { error?: string } } };
  return typed.response?.data?.error || fallback;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();
  const invalidateProjects = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => { invalidateProjects(); handleClose(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateProjectRequest> }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => { invalidateProjects(); handleClose(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: invalidateProjects,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project ? {
      name: project.name,
      description: project.description || '',
      clientId: project.client_id,
      startDate: project.start_date || '',
      endDate: project.end_date || '',
      status: project.status,
      budgetHours: project.budget_hours?.toString() || '',
    } : EMPTY_FORM);
    setError('');
    setOpen(true);
  };

  const updateField = (field: string, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) { setError('Project name is required'); return; }
    if (!formData.clientId) { setError('Please select a client'); return; }

    const budgetHours = formData.budgetHours ? parseFloat(formData.budgetHours) : null;
    if (budgetHours !== null && (isNaN(budgetHours) || budgetHours <= 0)) {
      setError('Budget hours must be a positive number');
      return;
    }

    const projectData: CreateProjectRequest = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      status: formData.status,
      budgetHours,
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

  const statusColor = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.color || 'default';

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

      {projects.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">No projects yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Click &quot;Add Project&quot; to create your first project
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
                <TableCell>Budget Hours</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project: Project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{project.name}</Typography>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{project.client_name}</TableCell>
                  <TableCell>
                    <Chip label={project.status} color={statusColor(project.status)} size="small" />
                  </TableCell>
                  <TableCell>{project.budget_hours ?? '—'}</TableCell>
                  <TableCell>{project.start_date || '—'}</TableCell>
                  <TableCell>{project.end_date || '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(project)} aria-label="edit project">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(project)} aria-label="delete project">
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
            {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required
              value={formData.name} onChange={e => updateField('name', e.target.value)} />
            <TextField margin="dense" label="Description" fullWidth multiline rows={2}
              value={formData.description} onChange={e => updateField('description', e.target.value)} />
            <FormControl fullWidth margin="dense" required>
              <InputLabel>Client</InputLabel>
              <Select value={formData.clientId || ''} label="Client"
                onChange={e => updateField('clientId', e.target.value as number)}>
                {clients.map((c: { id: number; name: string }) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel>Status</InputLabel>
              <Select value={formData.status} label="Status"
                onChange={e => updateField('status', e.target.value)}>
                {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Budget Hours" fullWidth type="number"
              inputProps={{ min: 0, step: 0.5 }}
              value={formData.budgetHours} onChange={e => updateField('budgetHours', e.target.value)} />
            <TextField margin="dense" label="Start Date" fullWidth type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.startDate} onChange={e => updateField('startDate', e.target.value)} />
            <TextField margin="dense" label="End Date" fullWidth type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.endDate} onChange={e => updateField('endDate', e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}>
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
