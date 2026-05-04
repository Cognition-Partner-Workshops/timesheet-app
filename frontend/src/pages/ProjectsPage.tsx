import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress,
  Chip, MenuItem, Select, FormControl, InputLabel, type SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type ProjectStatus, type Client } from '../types/api';
import { useCrudMutations } from '../hooks/useCrudMutations';

const STATUS_CONFIG: Record<ProjectStatus, { color: 'success' | 'default' | 'warning'; label: string }> = {
  active: { color: 'success', label: 'Active' },
  completed: { color: 'default', label: 'Completed' },
  'on-hold': { color: 'warning', label: 'On Hold' },
};

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  status: ProjectStatus;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(EMPTY_FORM);
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
    setFormData(EMPTY_FORM);
    setError('');
  };

  const { createMutation, updateMutation, deleteMutation, deleteAllMutation, isPending } = useCrudMutations({
    queryKey: 'projects',
    createFn: (data: { name: string; description?: string; clientId?: number | null; startDate?: string | null; status?: ProjectStatus }) =>
      apiClient.createProject(data),
    updateFn: ({ id, data }: { id: number; data: { name?: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string } }) =>
      apiClient.updateProject(id, data),
    deleteFn: (id: number) => apiClient.deleteProject(id),
    deleteAllFn: () => apiClient.deleteAllProjects(),
    onSuccess: handleClose,
    onError: setError,
  });

  const projects: Project[] = projectsData?.projects || [];
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
      clientId: formData.clientId ? parseInt(formData.clientId) : null,
      startDate: formData.startDate || null,
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`))
      deleteMutation.mutate(project.id);
  };

  const confirmDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete ALL projects? This action cannot be undone.'))
      deleteAllMutation.mutate();
  };

  const setField = (field: keyof ProjectFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

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
              onClick={confirmDeleteAll} disabled={deleteAllMutation.isPending}>
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
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? projects.map((project: Project) => {
                const cfg = STATUS_CONFIG[project.status];
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography>
                    </TableCell>
                    <TableCell>{project.client_name
                      ? <Typography variant="body2" color="text.secondary">{project.client_name}</Typography>
                      : <Chip label="-" size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell>{project.start_date
                      ? <Typography variant="body2" color="text.secondary">{new Date(project.start_date).toLocaleDateString()}</Typography>
                      : <Chip label="-" size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell><Chip label={cfg.label} color={cfg.color} size="small" /></TableCell>
                    <TableCell>{project.description
                      ? <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                      : <Chip label="No description" size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(project.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                      <IconButton onClick={() => confirmDelete(project)} color="error" size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              }) : (
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
              value={formData.name} onChange={setField('name')} disabled={isPending} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-client-label">Client</InputLabel>
              <Select labelId="project-client-label" value={formData.clientId} label="Client"
                onChange={setField('clientId')} disabled={isPending}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c: Client) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" fullWidth type="date"
              value={formData.startDate} onChange={setField('startDate')} disabled={isPending}
              slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-status-label">Status</InputLabel>
              <Select labelId="project-status-label" value={formData.status} label="Status"
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                disabled={isPending}>
                {(Object.entries(STATUS_CONFIG) as [ProjectStatus, { label: string }][]).map(([val, { label }]) => (
                  <MenuItem key={val} value={val}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={setField('description')} disabled={isPending} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isPending}>
              {isPending ? <CircularProgress size={24} /> : (editingProject ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
