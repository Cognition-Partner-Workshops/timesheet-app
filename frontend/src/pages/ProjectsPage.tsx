import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';
import CrudTable, { type ColumnDef } from '../components/CrudTable';

type ProjectStatus = 'active' | 'completed' | 'on-hold';

const statusColors: Record<ProjectStatus, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  'on-hold': 'warning',
};

const projectColumns: ColumnDef<Project>[] = [
  {
    label: 'Name',
    render: (p) => <Typography variant="subtitle1" fontWeight="medium">{p.name}</Typography>,
  },
  {
    label: 'Client',
    render: (p) => p.client_name
      ? <Typography variant="body2" color="text.secondary">{p.client_name}</Typography>
      : <Chip label="-" size="small" variant="outlined" />,
  },
  {
    label: 'Start Date',
    render: (p) => p.start_date
      ? <Typography variant="body2" color="text.secondary">{new Date(p.start_date).toLocaleDateString()}</Typography>
      : <Chip label="-" size="small" variant="outlined" />,
  },
  {
    label: 'Status',
    render: (p) => <Chip label={p.status} size="small" color={statusColors[p.status] || 'default'} />,
  },
  {
    label: 'Description',
    render: (p) => p.description
      ? <Typography variant="body2" color="text.secondary">{p.description}</Typography>
      : <Chip label="No description" size="small" variant="outlined" />,
  },
  {
    label: 'Created',
    render: (p) => <Typography variant="body2" color="text.secondary">{new Date(p.created_at).toLocaleDateString()}</Typography>,
  },
];

const emptyForm = { name: '', description: '', clientId: '' as string | number, startDate: '', status: 'active' as ProjectStatus };

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const onMutationError = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { error?: string } } };
    setError(e.response?.data?.error || fallback);
  };

  const createMutation = useMutation({
    mutationFn: (d: { name: string; description?: string; clientId?: number | null; startDate?: string; status?: string }) => apiClient.createProject(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: (err) => onMutationError(err, 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => apiClient.updateProject(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); handleClose(); },
    onError: (err) => onMutationError(err, 'Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err) => onMutationError(err, 'Failed to delete project'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiClient.deleteAllProjects(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err) => onMutationError(err, 'Failed to delete all projects'),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];

  const handleOpen = (project?: Project) => {
    setEditingProject(project ?? null);
    setFormData(project
      ? { name: project.name, description: project.description || '', clientId: project.client_id || '', startDate: project.start_date || '', status: project.status }
      : emptyForm
    );
    setError('');
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingProject(null); setFormData(emptyForm); setError(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Project name is required'); return; }

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      clientId: formData.clientId ? Number(formData.clientId) : null,
      startDate: formData.startDate || undefined,
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add Project</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <CrudTable
        items={projects}
        columns={projectColumns}
        keyField="id"
        emptyMessage="No projects found. Create your first project to get started."
        onEdit={handleOpen}
        onDelete={handleDelete}
      />

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required
              value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isSaving} />
            <TextField margin="dense" label="Client" fullWidth select
              value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} disabled={isSaving}>
              <MenuItem value="">None</MenuItem>
              {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField margin="dense" label="Start Date" fullWidth type="date" InputLabelProps={{ shrink: true }}
              value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} disabled={isSaving} />
            <TextField margin="dense" label="Status" fullWidth select
              value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })} disabled={isSaving}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
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
