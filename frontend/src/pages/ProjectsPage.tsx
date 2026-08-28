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
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

type ProjectStatus = 'active' | 'completed' | 'on-hold';

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  status: ProjectStatus;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: 'success' | 'default' | 'warning' }> = {
  active: { label: 'Active', color: 'success' },
  completed: { label: 'Completed', color: 'default' },
  'on-hold': { label: 'On Hold', color: 'warning' },
};

function formFromProject(project: Project): ProjectFormData {
  return {
    name: project.name,
    description: project.description || '',
    clientId: project.client_id ? String(project.client_id) : '',
    startDate: project.start_date || '',
    status: project.status,
  };
}

function formToPayload(form: ProjectFormData) {
  return {
    name: form.name,
    description: form.description || undefined,
    clientId: form.clientId ? parseInt(form.clientId) : null,
    startDate: form.startDate || null,
    status: form.status,
  };
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

  const onMutationError = (err: unknown) => {
    const e = err as { response?: { data?: { error?: string } } };
    setError(e.response?.data?.error || 'Operation failed');
  };

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formToPayload>) => apiClient.createProject(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: onMutationError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof formToPayload> }) => apiClient.updateProject(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: onMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    onError: onMutationError,
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiClient.deleteAllProjects(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    onError: onMutationError,
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const isMutating = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project || null);
    setFormData(project ? formFromProject(project) : EMPTY_FORM);
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }

    const payload = formToPayload(formData);
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
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
        <Box display="flex" gap={2}>
          {projects.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />}
              onClick={() => { if (window.confirm('Delete ALL projects? This cannot be undone.')) deleteAllMutation.mutate(); }}
              disabled={deleteAllMutation.isPending}>
              {deleteAllMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Project
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

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
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? projects.map((project: Project) => (
                <TableRow key={project.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography></TableCell>
                  <TableCell>{project.client_name || <Chip label="Unassigned" size="small" variant="outlined" />}</TableCell>
                  <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                  <TableCell><Chip label={STATUS_CONFIG[project.status].label} size="small" color={STATUS_CONFIG[project.status].color} /></TableCell>
                  <TableCell>{project.description || <Chip label="No description" size="small" variant="outlined" />}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => { if (window.confirm(`Delete "${project.name}"?`)) deleteMutation.mutate(project.id); }} color="error" size="small"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>No projects found. Create your first project to get started.</Typography>
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
              value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isMutating} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-client-label">Client</InputLabel>
              <Select labelId="project-client-label" value={formData.clientId} label="Client"
                onChange={(e: SelectChangeEvent) => setFormData({ ...formData, clientId: e.target.value })} disabled={isMutating}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" fullWidth type="date"
              value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              disabled={isMutating} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-status-label">Status</InputLabel>
              <Select labelId="project-status-label" value={formData.status} label="Status"
                onChange={(e: SelectChangeEvent) => setFormData({ ...formData, status: e.target.value as ProjectStatus })} disabled={isMutating}>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <MenuItem key={val} value={val}>{cfg.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isMutating} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isMutating}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isMutating}>
              {isMutating ? <CircularProgress size={24} /> : (editingProject ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
