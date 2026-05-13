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

const STATUSES = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'info' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
] as const;

type StatusValue = typeof STATUSES[number]['value'];

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string | number;
  startDate: string;
  status: string;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

function statusChip(status: string) {
  const s = STATUSES.find((o) => o.value === status);
  return <Chip label={s?.label ?? status} color={s?.color ?? 'default'} size="small" />;
}

function extractApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
}

const ProjectsPage: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['projects'] }), [qc]);
  const closeDialog = useCallback(() => { setDialogOpen(false); setEditTarget(null); setForm(EMPTY_FORM); setError(''); }, []);

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: number; payload: Record<string, unknown> }) =>
      vars.id ? apiClient.updateProject(vars.id, vars.payload) : apiClient.createProject(vars.payload as Parameters<typeof apiClient.createProject>[0]),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to save project')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const openDialog = useCallback((project?: Project) => {
    setError('');
    if (project) {
      setEditTarget(project);
      setForm({ name: project.name, description: project.description || '', clientId: project.client_id || '', startDate: project.start_date || '', status: project.status });
    } else {
      setEditTarget(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      clientId: form.clientId ? Number(form.clientId) : null,
      startDate: form.startDate || null,
      status: form.status as StatusValue,
    };
    saveMutation.mutate({ id: editTarget?.id, payload });
  };

  const confirmDelete = (p: Project) => { if (window.confirm(`Delete "${p.name}"?`)) removeMutation.mutate(p.id); };
  const isSaving = saveMutation.isPending;
  const projects: Project[] = projectsData?.projects ?? [];
  const clients: Client[] = clientsData?.clients ?? [];
  const updateField = (field: keyof ProjectFormData) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Projects</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>Add Project</Button>
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
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>No projects found. Create your first project to get started.</Typography>
                  </TableCell>
                </TableRow>
              ) : projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Typography variant="subtitle1" fontWeight="medium">{p.name}</Typography></TableCell>
                  <TableCell>{p.client_name ? <Typography variant="body2" color="text.secondary">{p.client_name}</Typography> : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                  <TableCell>{p.start_date ? <Typography variant="body2" color="text.secondary">{new Date(p.start_date).toLocaleDateString()}</Typography> : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                  <TableCell>{statusChip(p.status)}</TableCell>
                  <TableCell>{p.description ? <Typography variant="body2" color="text.secondary">{p.description}</Typography> : <Chip label="No description" size="small" variant="outlined" />}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => openDialog(p)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => confirmDelete(p)} color="error" size="small"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Project' : 'Add New Project'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required value={form.name} onChange={updateField('name')} disabled={isSaving} />
            <TextField margin="dense" label="Client" fullWidth select value={form.clientId} onChange={updateField('clientId')} disabled={isSaving}>
              <MenuItem value=""><em>None</em></MenuItem>
              {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Start Date" fullWidth type="date" value={form.startDate} onChange={updateField('startDate')} disabled={isSaving} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField margin="dense" label="Status" fullWidth select value={form.status} onChange={updateField('status')} disabled={isSaving}>
              {STATUSES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3} value={form.description} onChange={updateField('description')} disabled={isSaving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? <CircularProgress size={24} /> : (editTarget ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
