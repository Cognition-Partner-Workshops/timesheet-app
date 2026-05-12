import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, Chip, MenuItem, FormControl, InputLabel,
  Select, type SelectChangeEvent, Card, CardContent, Stack,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';

const STATUS_CONFIG: Record<string, { color: 'success' | 'default' | 'warning'; label: string }> = {
  active: { color: 'success', label: 'Active' },
  completed: { color: 'default', label: 'Completed' },
  'on-hold': { color: 'warning', label: 'On Hold' },
};

interface ProjectFormData {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  status: string;
}

const EMPTY_FORM: ProjectFormData = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

function extractApiError(err: unknown, fallback: string): string {
  const typed = err as { response?: { data?: { error?: string } } };
  return typed.response?.data?.error || fallback;
}

function StatsSummary({ projects }: { projects: Project[] }) {
  const counts = projects.reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  return (
    <Stack direction="row" spacing={2} mb={3}>
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <Card key={key} variant="outlined" sx={{ minWidth: 120 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight="bold">{counts[key] || 0}</Typography>
            <Chip label={cfg.label} size="small" color={cfg.color} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
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

  const onMutationError = useCallback((err: unknown, action: string) => {
    setError(extractApiError(err, `Failed to ${action} project`));
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; clientId?: number | null; startDate: string; status?: string }) =>
      apiClient.createProject(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: (err: unknown) => onMutationError(err, 'create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: (err: unknown) => onMutationError(err, 'update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err: unknown) => onMutationError(err, 'delete'),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project ? {
      name: project.name,
      description: project.description || '',
      clientId: project.client_id ? String(project.client_id) : '',
      startDate: project.start_date ? project.start_date.split('T')[0] : '',
      status: project.status,
    } : EMPTY_FORM);
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
    if (!formData.startDate) { setError('Start date is required'); return; }

    const payload = {
      name: formData.name,
      description: formData.description || (editingProject ? '' : undefined),
      clientId: formData.clientId ? parseInt(formData.clientId) : null,
      startDate: formData.startDate,
      status: formData.status,
    };
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`))
      deleteMutation.mutate(project.id);
  };

  const onFieldChange = (field: keyof ProjectFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const onSelectChange = (e: SelectChangeEvent) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Projects</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Add Project
        </Button>
      </Box>

      <StatsSummary projects={projects} />

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
                <TableRow key={project.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{project.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {project.client_name
                      ? <Typography variant="body2" color="text.secondary">{project.client_name}</Typography>
                      : <Chip label="Unassigned" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(project.start_date).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={STATUS_CONFIG[project.status]?.label ?? project.status}
                      size="small" color={STATUS_CONFIG[project.status]?.color ?? 'default'} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      {project.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpen(project)} color="primary" size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(project)} color="error" size="small"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
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
              value={formData.name} onChange={onFieldChange('name')} disabled={isSaving} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-client-label">Client</InputLabel>
              <Select labelId="project-client-label" name="clientId" value={formData.clientId}
                label="Client" onChange={onSelectChange} disabled={isSaving}>
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c: Client) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" type="date" fullWidth required
              value={formData.startDate} onChange={onFieldChange('startDate')} disabled={isSaving}
              slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-status-label">Status</InputLabel>
              <Select labelId="project-status-label" name="status" value={formData.status}
                label="Status" onChange={onSelectChange} disabled={isSaving}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) =>
                  <MenuItem key={key} value={key}>{cfg.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3}
              value={formData.description} onChange={onFieldChange('description')} disabled={isSaving} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? <CircularProgress size={24} /> : editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
