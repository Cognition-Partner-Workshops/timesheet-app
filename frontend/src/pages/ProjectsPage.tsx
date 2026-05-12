import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress,
  Chip, MenuItem,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';
import { useCrudOperations } from '../hooks/useCrudOperations';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'success' as const },
  { value: 'completed', label: 'Completed', color: 'info' as const },
  { value: 'on-hold', label: 'On Hold', color: 'warning' as const },
];

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string | number;
  startDate: string;
  status: string;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(EMPTY_FORM);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const { createMutation, updateMutation, deleteMutation, deleteAllMutation, error, setError } = useCrudOperations({
    queryKey: 'projects',
    createFn: (data: ProjectFormData) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        clientId: data.clientId ? Number(data.clientId) : null,
        startDate: data.startDate || null,
        status: data.status,
      };
      return apiClient.createProject(payload);
    },
    updateFn: ({ id, data }: { id: number; data: Partial<ProjectFormData> }) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        clientId: data.clientId ? Number(data.clientId) : null,
        startDate: data.startDate || null,
        status: data.status,
      };
      return apiClient.updateProject(id, payload);
    },
    deleteFn: (id: number) => apiClient.deleteProject(id),
    deleteAllFn: () => apiClient.deleteAllProjects(),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

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
      setFormData(EMPTY_FORM);
    }
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }

    const onDone = { onSuccess: handleClose };
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: formData }, onDone);
    } else {
      createMutation.mutate(formData, onDone);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              onClick={() => window.confirm('Are you sure you want to delete ALL projects? This action cannot be undone.') && deleteAllMutation.mutate()}
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
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography></TableCell>
                  <TableCell>
                    {project.client_name
                      ? <Typography variant="body2" color="text.secondary">{project.client_name}</Typography>
                      : <Chip label="Unassigned" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    {project.start_date
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
                  <TableCell>
                    {project.description
                      ? <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                      : <Chip label="No description" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{new Date(project.created_at).toLocaleDateString()}</Typography></TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => window.confirm(`Are you sure you want to delete "${project.name}"?`) && deleteMutation.mutate(project.id)} color="error" size="small"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
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
              value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isSaving} />
            <TextField margin="dense" label="Client" fullWidth select
              value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} disabled={isSaving}>
              <MenuItem value=""><em>None</em></MenuItem>
              {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Start Date" fullWidth type="date"
              value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              disabled={isSaving} InputLabelProps={{ shrink: true }} />
            <TextField margin="dense" label="Status" fullWidth select
              value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={isSaving}>
              {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isSaving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSaving}>Cancel</Button>
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
