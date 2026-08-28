import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Chip, MenuItem, Select, FormControl,
  InputLabel, type SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

interface ProjectFormData {
  name: string;
  description: string;
  client_id: string;
  start_date: string;
  status: string;
}

const INITIAL_FORM: ProjectFormData = { name: '', description: '', client_id: '', start_date: '', status: 'active' };

const STATUS_CHIP_COLOR: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success', completed: 'default', 'on-hold': 'warning',
};

function extractApiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const invalidateProjects = useCallback(() => queryClient.invalidateQueries({ queryKey: ['projects'] }), [queryClient]);
  const resetForm = useCallback(() => { setOpen(false); setEditingProject(null); setFormData(INITIAL_FORM); setError(''); }, []);

  const createMutation = useMutation({
    mutationFn: apiClient.createProject.bind(apiClient),
    onSuccess: () => { invalidateProjects(); resetForm(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof apiClient.updateProject>[1] }) => apiClient.updateProject(id, data),
    onSuccess: () => { invalidateProjects(); resetForm(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteProject.bind(apiClient),
    onSuccess: invalidateProjects,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const projects: Project[] = projectsData?.projects ?? [];
  const clients: Client[] = clientsData?.clients ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project
      ? { name: project.name, description: project.description || '', client_id: project.client_id ? String(project.client_id) : '', start_date: project.start_date || '', status: project.status }
      : INITIAL_FORM);
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
      client_id: formData.client_id ? parseInt(formData.client_id) : null,
      start_date: formData.start_date || null,
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) deleteMutation.mutate(project.id);
  };

  const onFieldChange = (field: keyof ProjectFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const onSelectChange = (e: SelectChangeEvent) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  if (isLoading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;

  const renderOptionalCell = (value: string | null, placeholder = '-') =>
    value ? <Typography variant="body2" color="text.secondary">{value}</Typography> : <Chip label={placeholder} size="small" variant="outlined" />;

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
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography></TableCell>
                  <TableCell>{renderOptionalCell(project.client_name)}</TableCell>
                  <TableCell>{project.start_date ? renderOptionalCell(new Date(project.start_date).toLocaleDateString()) : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                  <TableCell><Chip label={project.status} size="small" color={STATUS_CHIP_COLOR[project.status] ?? 'default'} /></TableCell>
                  <TableCell>{renderOptionalCell(project.description, 'No description')}</TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{new Date(project.created_at).toLocaleDateString()}</Typography></TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(project)} color="error" size="small"><DeleteIcon /></IconButton>
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

      <Dialog open={open} onClose={resetForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required value={formData.name} onChange={onFieldChange('name')} disabled={isSaving} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-client-label">Client</InputLabel>
              <Select labelId="project-client-label" name="client_id" value={formData.client_id} label="Client" onChange={onSelectChange} disabled={isSaving}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" fullWidth type="date" value={formData.start_date} onChange={onFieldChange('start_date')} disabled={isSaving} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-status-label">Status</InputLabel>
              <Select labelId="project-status-label" name="status" value={formData.status} label="Status" onChange={onSelectChange} disabled={isSaving}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3} value={formData.description} onChange={onFieldChange('description')} disabled={isSaving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={resetForm} disabled={isSaving}>Cancel</Button>
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
