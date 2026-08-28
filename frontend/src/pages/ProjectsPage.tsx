import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
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
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Project, type Client } from '../types/api';
import { useCrudOperations } from '../hooks/useCrudOperations';

type ProjectStatus = 'active' | 'completed' | 'on-hold';

const STATUS_CONFIG: Record<ProjectStatus, { color: 'success' | 'default' | 'warning'; label: string }> = {
  active: { color: 'success', label: 'Active' },
  completed: { color: 'default', label: 'Completed' },
  'on-hold': { color: 'warning', label: 'On Hold' },
};

interface ProjectFormState {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  status: ProjectStatus;
}

const INITIAL_FORM: ProjectFormState = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

const ProjectsPage: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(INITIAL_FORM);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  type CreatePayload = { name: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string };
  type UpdatePayload = { name?: string; description?: string; clientId?: number | null; startDate?: string | null; status?: string };

  const crud = useCrudOperations<CreatePayload, UpdatePayload>({
    queryKey: 'projects',
    createFn: (data) => apiClient.createProject(data),
    updateFn: (id, data) => apiClient.updateProject(id, data),
    deleteFn: (id) => apiClient.deleteProject(id),
  });

  const projects: Project[] = projectsData?.projects || [];
  const clients: Client[] = clientsData?.clients || [];

  const openDialog = useCallback((project?: Project) => {
    if (project) {
      setEditTarget(project);
      setForm({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id ? String(project.client_id) : '',
        startDate: project.start_date || '',
        status: project.status,
      });
    } else {
      setEditTarget(null);
      setForm(INITIAL_FORM);
    }
    crud.setError('');
    setDialogOpen(true);
  }, [crud]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditTarget(null);
    setForm(INITIAL_FORM);
    crud.setError('');
  }, [crud]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    crud.setError('');
    if (!form.name.trim()) {
      crud.setError('Project name is required');
      return;
    }

    const payload = {
      name: form.name,
      description: form.description || undefined,
      clientId: form.clientId ? parseInt(form.clientId) : null,
      startDate: form.startDate || null,
      status: form.status,
    };

    const mutation = editTarget
      ? crud.updateMutation.mutateAsync({ id: editTarget.id, data: payload })
      : crud.createMutation.mutateAsync(payload);

    mutation.then(closeDialog).catch(() => {});
  };

  const confirmDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      crud.deleteMutation.mutate(project.id);
    }
  };

  const updateField = (field: keyof ProjectFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const updateSelect = (e: SelectChangeEvent) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
          Add Project
        </Button>
      </Box>

      {crud.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => crud.setError('')}>
          {crud.error}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 6 }}>
          No projects yet. Click &quot;Add Project&quot; to create one.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => {
            const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%' }}>
                        {project.name}
                      </Typography>
                      <Chip label={statusCfg.label} color={statusCfg.color} size="small" />
                    </Box>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {project.description}
                      </Typography>
                    )}
                    {project.client_name && (
                      <Typography variant="body2">
                        <strong>Client:</strong> {project.client_name}
                      </Typography>
                    )}
                    {project.start_date && (
                      <Typography variant="body2">
                        <strong>Start:</strong> {project.start_date}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openDialog(project)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => confirmDelete(project)}>
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <form onSubmit={onSubmit}>
          <DialogTitle>{editTarget ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogContent>
            {crud.error && <Alert severity="error" sx={{ mb: 2 }}>{crud.error}</Alert>}
            <TextField
              autoFocus
              margin="dense"
              label="Project Name"
              fullWidth
              required
              value={form.name}
              onChange={updateField('name')}
            />
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={updateField('description')}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-client-label">Client</InputLabel>
              <Select
                labelId="project-client-label"
                name="clientId"
                value={form.clientId}
                label="Client"
                onChange={updateSelect}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={form.startDate}
              onChange={updateField('startDate')}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel id="project-status-label">Status</InputLabel>
              <Select
                labelId="project-status-label"
                name="status"
                value={form.status}
                label="Status"
                onChange={updateSelect}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={crud.isSaving}>
              {editTarget ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
