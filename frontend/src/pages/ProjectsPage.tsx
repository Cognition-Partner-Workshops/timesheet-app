import React, { useReducer, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Alert, CircularProgress, Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, DeleteSweep as DeleteSweepIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Client, type Project, type ProjectStatus, type CreateProjectRequest, type UpdateProjectRequest } from '../types/api';

// -- Constants ----------------------------------------------------------------
const STATUSES: { value: ProjectStatus; label: string; color: 'success' | 'default' | 'warning' }[] = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
];
const statusMeta = (s: ProjectStatus) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
const toISODate = (v: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

// -- Reducer-based state ------------------------------------------------------
interface FormFields { name: string; description: string; clientId: number | ''; startDate: string; status: ProjectStatus }
const EMPTY_FORM: FormFields = { name: '', description: '', clientId: '', startDate: '', status: 'active' };

type PageState = { dialogOpen: boolean; editing: Project | null; form: FormFields; error: string };
type PageAction =
  | { type: 'OPEN_ADD' }
  | { type: 'OPEN_EDIT'; project: Project }
  | { type: 'CLOSE' }
  | { type: 'SET_FIELD'; field: keyof FormFields; value: FormFields[keyof FormFields] }
  | { type: 'SET_ERROR'; error: string };

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'OPEN_ADD':
      return { dialogOpen: true, editing: null, form: { ...EMPTY_FORM }, error: '' };
    case 'OPEN_EDIT':
      return {
        dialogOpen: true,
        editing: action.project,
        form: {
          name: action.project.name,
          description: action.project.description ?? '',
          clientId: action.project.client_id ?? '',
          startDate: toISODate(action.project.start_date),
          status: action.project.status,
        },
        error: '',
      };
    case 'CLOSE':
      return { dialogOpen: false, editing: null, form: { ...EMPTY_FORM }, error: '' };
    case 'SET_FIELD':
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case 'SET_ERROR':
      return { ...state, error: action.error };
  }
}

// -- Mutation helper ----------------------------------------------------------
const extractApiError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error ?? fallback;
};

// -- Component ----------------------------------------------------------------
const ProjectsPage: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, { dialogOpen: false, editing: null, form: { ...EMPTY_FORM }, error: '' });
  const qc = useQueryClient();
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['projects'] }), [qc]);

  const { data: projectsData, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => apiClient.getProjects() });
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });

  const saveMutation = useMutation({
    mutationFn: (args: { id?: number; payload: CreateProjectRequest | UpdateProjectRequest }) =>
      args.id ? apiClient.updateProject(args.id, args.payload as UpdateProjectRequest) : apiClient.createProject(args.payload as CreateProjectRequest),
    onSuccess: () => { invalidate(); dispatch({ type: 'CLOSE' }); },
    onError: (err: unknown) => dispatch({ type: 'SET_ERROR', error: extractApiError(err, 'Save failed') }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: invalidate,
    onError: (err: unknown) => dispatch({ type: 'SET_ERROR', error: extractApiError(err, 'Delete failed') }),
  });

  const removeAllMutation = useMutation({
    mutationFn: () => apiClient.deleteAllProjects(),
    onSuccess: invalidate,
    onError: (err: unknown) => dispatch({ type: 'SET_ERROR', error: extractApiError(err, 'Clear failed') }),
  });

  const projects: Project[] = projectsData?.projects ?? [];
  const clients: Client[] = clientsData?.clients ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.form.name.trim()) { dispatch({ type: 'SET_ERROR', error: 'Project name is required' }); return; }
    const payload = {
      name: state.form.name,
      description: state.form.description || undefined,
      clientId: state.form.clientId === '' ? null : Number(state.form.clientId),
      startDate: state.form.startDate || null,
      status: state.form.status,
    };
    saveMutation.mutate({ id: state.editing?.id, payload });
  };

  const confirmRemove = (p: Project) => { if (window.confirm(`Delete "${p.name}"?`)) removeMutation.mutate(p.id); };
  const confirmRemoveAll = () => { if (window.confirm('Delete ALL projects? This cannot be undone.')) removeAllMutation.mutate(); };

  if (isLoading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;

  const busy = saveMutation.isPending;
  const setField = (field: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    dispatch({ type: 'SET_FIELD', field, value: e.target.value });

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Projects</Typography>
        <Box display="flex" gap={2}>
          {projects.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />}
              onClick={confirmRemoveAll} disabled={removeAllMutation.isPending}>
              {removeAllMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => dispatch({ type: 'OPEN_ADD' })}>Add Project</Button>
        </Box>
      </Box>

      {state.error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch({ type: 'SET_ERROR', error: '' })}>{state.error}</Alert>}

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead><TableRow>
              {['Name', 'Client', 'Start Date', 'Status', 'Description'].map((h) => <TableCell key={h}>{h}</TableCell>)}
              <TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>No projects found. Create your first project to get started.</Typography>
                </TableCell></TableRow>
              ) : projects.map((p) => {
                const sm = statusMeta(p.status);
                return (
                  <TableRow key={p.id}>
                    <TableCell><Typography variant="subtitle1" fontWeight="medium">{p.name}</Typography></TableCell>
                    <TableCell>{p.client_name
                      ? <Typography variant="body2" color="text.secondary">{p.client_name}</Typography>
                      : <Chip label="Unassigned" size="small" variant="outlined" />}</TableCell>
                    <TableCell>{p.start_date
                      ? <Typography variant="body2" color="text.secondary">{new Date(p.start_date).toLocaleDateString()}</Typography>
                      : <Chip label="-" size="small" variant="outlined" />}</TableCell>
                    <TableCell><Chip label={sm.label} size="small" color={sm.color} /></TableCell>
                    <TableCell>{p.description
                      ? <Typography variant="body2" color="text.secondary">{p.description}</Typography>
                      : <Chip label="No description" size="small" variant="outlined" />}</TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => dispatch({ type: 'OPEN_EDIT', project: p })} color="primary" size="small"><EditIcon /></IconButton>
                      <IconButton onClick={() => confirmRemove(p)} color="error" size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog */}
      <Dialog open={state.dialogOpen} onClose={() => dispatch({ type: 'CLOSE' })} maxWidth="sm" fullWidth>
        <DialogTitle>{state.editing ? 'Edit Project' : 'Add New Project'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Project Name" fullWidth required
              value={state.form.name} onChange={setField('name')} disabled={busy} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="proj-client">Client</InputLabel>
              <Select labelId="proj-client" label="Client" disabled={busy}
                value={state.form.clientId === '' ? '' : String(state.form.clientId)}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'clientId', value: e.target.value === '' ? '' : Number(e.target.value) })}>
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Start Date" type="date" fullWidth disabled={busy}
              value={state.form.startDate} onChange={setField('startDate')} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl fullWidth margin="dense">
              <InputLabel id="proj-status">Status</InputLabel>
              <Select labelId="proj-status" label="Status" disabled={busy}
                value={state.form.status}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'status', value: e.target.value as ProjectStatus })}>
                {STATUSES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField margin="dense" label="Description" fullWidth multiline rows={3} disabled={busy}
              value={state.form.description} onChange={setField('description')} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch({ type: 'CLOSE' })} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? <CircularProgress size={24} /> : state.editing ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
