import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Chip, MenuItem,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'info' | 'warning' }> = {
  active: { label: 'Active', color: 'success' },
  completed: { label: 'Completed', color: 'info' },
  'on-hold': { label: 'On Hold', color: 'warning' },
};

const EMPTY_FORM = { name: '', description: '', clientId: '' as string | number, startDate: '', status: 'active' };

function extractApiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const invalidateProjects = useCallback(() => queryClient.invalidateQueries({ queryKey: ['projects'] }), [queryClient]);
  const resetForm = useCallback(() => { setOpen(false); setEditingProject(null); setFormData({ ...EMPTY_FORM }); setError(''); }, []);

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

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project
      ? { name: project.name, description: project.description || '', clientId: project.client_id ?? '', startDate: project.start_date || '', status: project.status }
      : { ...EMPTY_FORM });
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
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) deleteMutation.mutate(project.id);
  };

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;

  const renderCell = (value: string | null, fallback: string) =>
    value ? <Typography variant="body2" color="text.secondary">{value}</Typography> : <Chip label={fallback} size="small" variant="outlined" />;

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
                {['Name', 'Client', 'Start Date', 'Status', 'Description', 'Created', ''].map((h, i) => (
                  <TableCell key={h || 'actions'} align={i === 6 ? 'right' : 'left'}>{h || 'Actions'}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length > 0 ? projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{p.name}</Typography></TableCell>
                  <TableCell>{renderCell(p.client_name, 'Unassigned')}</TableCell>
                  <TableCell>{p.start_date ? renderCell(new Date(p.start_date).toLocaleDateString(), '-') : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                  <TableCell><Chip label={STATUS_CONFIG[p.status]?.label || p.status} color={STATUS_CONFIG[p.status]?.color || 'default'} size="small" /></TableCell>
                  <TableCell>{renderCell(p.description, 'No description')}</TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{new Date(p.created_at).toLocaleDateString()}</Typography></TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(p)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => confirmDelete(p)} color="error" size="small"><DeleteIcon /></IconButton>
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
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required value={formData.name} onChange={updateField('name')} disabled={saving} />
            <TextField margin="dense" label="Client" fullWidth select value={formData.clientId} onChange={updateField('clientId')} disabled={saving}>
              <MenuItem value=""><em>None</em></MenuItem>
              {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Start Date" fullWidth type="date" value={formData.startDate} onChange={updateField('startDate')} disabled={saving} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField margin="dense" label="Status" fullWidth select value={formData.status} onChange={updateField('status')} disabled={saving}>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <MenuItem key={val} value={val}>{cfg.label}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3} value={formData.description} onChange={updateField('description')} disabled={saving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={resetForm} disabled={saving}>Cancel</Button>
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
