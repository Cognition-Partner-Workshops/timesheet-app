import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress, Chip,
  MenuItem, Select, FormControl, InputLabel, type SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';
import { useCrudMutations } from '../hooks/useCrudMutations';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'success' as const },
  { value: 'completed', label: 'Completed', color: 'info' as const },
  { value: 'on-hold', label: 'On Hold', color: 'warning' as const },
];

type ProjectPayload = { name: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string };

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', clientId: '' as string, startDate: '', status: 'active' });
  const [error, setError] = useState('');

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData({ name: '', description: '', clientId: '', startDate: '', status: 'active' });
    setError('');
  };

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<ProjectPayload, ProjectPayload>({
    queryKey: 'projects',
    createFn: (d) => apiClient.createProject(d),
    updateFn: (id, d) => apiClient.updateProject(id, d),
    deleteFn: (id) => apiClient.deleteProject(id),
    onSuccess: handleClose,
    onError: setError,
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

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
      setFormData({ name: '', description: '', clientId: '', startDate: '', status: 'active' });
    }
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }

    const payload: ProjectPayload = {
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

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  if (isLoading) {
    return (<Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>);
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Projects</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add Project</Button>
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
              {projects.length > 0 ? projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography></TableCell>
                  <TableCell>{project.client_name
                    ? <Typography variant="body2" color="text.secondary">{project.client_name}</Typography>
                    : <Chip label="Unassigned" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>{project.start_date
                    ? <Typography variant="body2" color="text.secondary">{new Date(project.start_date).toLocaleDateString()}</Typography>
                    : <Chip label="-" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_OPTIONS.find((o) => o.value === project.status)?.label || project.status}
                      color={STATUS_OPTIONS.find((o) => o.value === project.status)?.color || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{project.description
                    ? <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                    : <Chip label="No description" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(project)} color="error" size="small"><DeleteIcon /></IconButton>
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
              value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isPending} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="client-select-label">Client</InputLabel>
              <Select labelId="client-select-label" value={formData.clientId} label="Client"
                onChange={(e: SelectChangeEvent) => setFormData({ ...formData, clientId: e.target.value })} disabled={isPending}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" fullWidth type="date" InputLabelProps={{ shrink: true }}
              value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} disabled={isPending} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="status-select-label">Status</InputLabel>
              <Select labelId="status-select-label" value={formData.status} label="Status"
                onChange={(e: SelectChangeEvent) => setFormData({ ...formData, status: e.target.value })} disabled={isPending}>
                {STATUS_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isPending} />
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
