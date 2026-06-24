import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, Chip, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../api/client';
import { type Project } from '../types/api';

const STATUS_CHIPS: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success', completed: 'default', 'on-hold': 'warning',
};

const EMPTY_FORM = {
  name: '', description: '', clientId: 0,
  startDate: null as Date | null, endDate: null as Date | null,
  status: 'active' as string, budgetHours: '',
};

function extractApiError(err: unknown, fallback: string): string {
  const typed = err as { response?: { data?: { error?: string } } };
  return typed.response?.data?.error || fallback;
}

function formatDateField(d: Date | null): string | undefined {
  return d ? d.toISOString().split('T')[0] : undefined;
}

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'], queryFn: () => apiClient.getProjects(),
  });
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'], queryFn: () => apiClient.getClients(),
  });

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditingProject(null);
    setFormData({ ...EMPTY_FORM });
    setError('');
  }, []);

  const invalidateProjects = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); } };

  const createMutation = useMutation({
    mutationFn: apiClient.createProject.bind(apiClient),
    ...invalidateProjects,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof apiClient.updateProject>[1] }) =>
      apiClient.updateProject(id, data),
    ...invalidateProjects,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteProject.bind(apiClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete project')),
  });

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project ? {
      name: project.name,
      description: project.description || '',
      clientId: project.client_id,
      startDate: project.start_date ? new Date(project.start_date) : null,
      endDate: project.end_date ? new Date(project.end_date) : null,
      status: project.status,
      budgetHours: project.budget_hours ? String(project.budget_hours) : '',
    } : { ...EMPTY_FORM });
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }
    if (!formData.clientId) { setError('Please select a client'); return; }

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId,
      status: formData.status,
      startDate: formatDateField(formData.startDate),
      endDate: formatDateField(formData.endDate),
      budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : undefined,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  if (projectsLoading || clientsLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Projects</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add Project</Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {clients.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              You need to create at least one client before adding projects.
            </Typography>
            <Button variant="contained" href="/clients">Create Client</Button>
          </Paper>
        ) : (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Budget Hours</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projects.length > 0 ? projects.map((project: Project) => (
                    <TableRow key={project.id}>
                      <TableCell><Typography variant="subtitle1" fontWeight="medium">{project.name}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{project.client_name}</Typography></TableCell>
                      <TableCell>
                        <Chip label={project.status} color={STATUS_CHIPS[project.status] || 'default'} size="small" />
                      </TableCell>
                      <TableCell>
                        {project.start_date
                          ? <Typography variant="body2">{new Date(project.start_date).toLocaleDateString()}</Typography>
                          : <Chip label="-" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {project.end_date
                          ? <Typography variant="body2">{new Date(project.end_date).toLocaleDateString()}</Typography>
                          : <Chip label="-" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {project.budget_hours
                          ? <Chip label={`${project.budget_hours} hrs`} color="primary" variant="outlined" size="small" />
                          : <Chip label="-" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {project.description
                          ? <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                          : <Chip label="No description" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                        <IconButton onClick={() => { if (window.confirm(`Delete "${project.name}"?`)) deleteMutation.mutate(project.id); }} color="error" size="small"><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>No projects found. Create your first project to get started.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField autoFocus margin="dense" label="Project Name" fullWidth required
                value={formData.name} onChange={e => updateField('name', e.target.value)} disabled={saving} />

              <FormControl fullWidth margin="dense" required>
                <InputLabel>Client</InputLabel>
                <Select value={formData.clientId} onChange={e => updateField('clientId', Number(e.target.value))} disabled={saving}>
                  {clients.map((c: { id: number; name: string }) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="dense">
                <InputLabel>Status</InputLabel>
                <Select value={formData.status} onChange={e => updateField('status', e.target.value)} disabled={saving}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on-hold">On Hold</MenuItem>
                </Select>
              </FormControl>

              <DatePicker label="Start Date" value={formData.startDate} onChange={d => updateField('startDate', d)}
                slotProps={{ textField: { fullWidth: true, margin: 'dense', disabled: saving } }} />

              <DatePicker label="End Date" value={formData.endDate} onChange={d => updateField('endDate', d)}
                slotProps={{ textField: { fullWidth: true, margin: 'dense', disabled: saving } }} />

              <TextField margin="dense" label="Budget Hours" type="number" fullWidth
                inputProps={{ min: 0, step: 0.5 }} value={formData.budgetHours}
                onChange={e => updateField('budgetHours', e.target.value)} disabled={saving} />

              <TextField margin="dense" label="Description" fullWidth multiline rows={3}
                value={formData.description} onChange={e => updateField('description', e.target.value)} disabled={saving} />
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
    </LocalizationProvider>
  );
};

export default ProjectsPage;
