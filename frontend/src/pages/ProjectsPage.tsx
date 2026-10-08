import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useClients } from '../hooks/useClients';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects';
import { type Project, type ProjectStatus } from '../types/api';

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: ChipProps['color'] }[] = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'default' },
];

const getStatusOption = (status: ProjectStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];

interface ProjectFormData {
  name: string;
  description: string;
  clientId: number;
  startDate: Date | null;
  status: ProjectStatus;
}

const emptyForm = (): ProjectFormData => ({
  name: '',
  description: '',
  clientId: 0,
  startDate: new Date(),
  status: 'active',
});

const getErrorMessage = (err: unknown, fallback: string) => {
  const error = err as { response?: { data?: { error?: string } } };
  return error.response?.data?.error || fallback;
};

const ProjectsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyForm);
  const [error, setError] = useState('');

  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const submitLabel = editingProject ? 'Update' : 'Create';

  const handleOpen = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        clientId: project.client_id,
        startDate: parseISO(project.start_date),
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData(emptyForm());
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData(emptyForm());
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!formData.clientId) {
      setError('Please select a client');
      return;
    }

    if (!formData.startDate || Number.isNaN(formData.startDate.getTime())) {
      setError('Please select a valid start date');
      return;
    }

    const projectData = {
      name: formData.name,
      description: formData.description,
      clientId: formData.clientId,
      startDate: format(formData.startDate, 'yyyy-MM-dd'),
      status: formData.status,
    };

    if (editingProject) {
      updateMutation.mutate(
        { id: editingProject.id, data: projectData },
        {
          onSuccess: handleClose,
          onError: (err) => setError(getErrorMessage(err, 'Failed to update project')),
        }
      );
    } else {
      createMutation.mutate(
        { ...projectData, description: projectData.description || undefined },
        {
          onSuccess: handleClose,
          onError: (err) => setError(getErrorMessage(err, 'Failed to create project')),
        }
      );
    }
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id, {
        onError: (err) => setError(getErrorMessage(err, 'Failed to delete project')),
      });
    }
  };

  if (projectsLoading || clientsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Projects</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
            disabled={clients.length === 0}
          >
            Add Project
          </Button>
        </Box>

        {error && !open && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {clients.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              You need to create at least one client before adding projects.
            </Typography>
            <Button variant="contained" href="/clients">
              Create Client
            </Button>
          </Paper>
        ) : (
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
                  {projects.length > 0 ? (
                    projects.map((project) => {
                      const statusOption = getStatusOption(project.status);
                      return (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {project.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{project.client_name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {parseISO(project.start_date).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={statusOption.label} color={statusOption.color} size="small" />
                          </TableCell>
                          <TableCell>
                            {project.description ? (
                              <Typography variant="body2" color="text.secondary">
                                {project.description}
                              </Typography>
                            ) : (
                              <Chip label="No description" size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              onClick={() => handleOpen(project)}
                              color="primary"
                              size="small"
                              aria-label={`Edit ${project.name}`}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDelete(project)}
                              color="error"
                              size="small"
                              aria-label={`Delete ${project.name}`}
                              disabled={deleteMutation.isPending}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
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
        )}

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <TextField
                autoFocus
                margin="dense"
                label="Project Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />

              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-client-label">Client</InputLabel>
                <Select
                  labelId="project-client-label"
                  label="Client"
                  value={formData.clientId || ''}
                  onChange={(e) => setFormData({ ...formData, clientId: Number(e.target.value) })}
                  disabled={isSaving}
                >
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <DatePicker
                label="Start Date"
                value={formData.startDate}
                onChange={(date) => setFormData({ ...formData, startDate: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'dense',
                    required: true,
                    disabled: isSaving,
                  },
                }}
              />

              <FormControl fullWidth margin="dense" required>
                <InputLabel id="project-status-label">Status</InputLabel>
                <Select
                  labelId="project-status-label"
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                  disabled={isSaving}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                margin="dense"
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSaving}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSaving}>
                {isSaving ? <CircularProgress size={24} /> : submitLabel}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectsPage;
