import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  CircularProgress, FormControl, InputLabel, Select, MenuItem, Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../api/client';
import { type WorkEntry } from '../types/api';
import { extractApiError } from '../utils/apiError';

const EMPTY_FORM = { clientId: 0, projectId: 0, hours: '', description: '', date: new Date() };

const WorkEntriesPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: workEntriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['workEntries'], queryFn: () => apiClient.getWorkEntries(),
  });
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'], queryFn: () => apiClient.getClients(),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects'], queryFn: () => apiClient.getProjects(),
  });

  const resetForm = () => { setOpen(false); setEditingEntry(null); setFormData({ ...EMPTY_FORM }); setError(''); };
  const invalidateEntries = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workEntries'] }); resetForm(); } };

  const createMutation = useMutation({
    mutationFn: apiClient.createWorkEntry.bind(apiClient),
    ...invalidateEntries,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to create work entry')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof apiClient.updateWorkEntry>[1] }) =>
      apiClient.updateWorkEntry(id, data),
    ...invalidateEntries,
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to update work entry')),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteWorkEntry.bind(apiClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workEntries'] }),
    onError: (err: unknown) => setError(extractApiError(err, 'Failed to delete work entry')),
  });

  const workEntries = workEntriesData?.workEntries || [];
  const clients = clientsData?.clients || [];
  const projects = projectsData?.projects || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (entry?: WorkEntry) => {
    setEditingEntry(entry ?? null);
    setFormData(entry ? {
      clientId: entry.client_id, projectId: entry.project_id || 0,
      hours: entry.hours.toString(), description: entry.description || '',
      date: new Date(entry.date),
    } : { ...EMPTY_FORM });
    setError('');
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.clientId) { setError('Please select a client'); return; }
    const hours = parseFloat(formData.hours);
    if (!hours || hours <= 0 || hours > 24) { setError('Hours must be between 0 and 24'); return; }
    if (!formData.date) { setError('Please select a date'); return; }

    const payload: { clientId: number; projectId?: number; hours: number; description?: string; date: string } = {
      clientId: formData.clientId, hours,
      description: formData.description || undefined,
      date: formData.date.toISOString().split('T')[0],
    };
    if (formData.projectId) payload.projectId = formData.projectId;

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = <K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  if (entriesLoading || clientsLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Work Entries</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add Work Entry</Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {clients.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>You need to create at least one client before adding work entries.</Typography>
            <Button variant="contained" href="/clients">Create Client</Button>
          </Paper>
        ) : (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Hours</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workEntries.length > 0 ? workEntries.map((entry: WorkEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell><Typography variant="subtitle1" fontWeight="medium">{entry.client_name}</Typography></TableCell>
                      <TableCell>
                        {entry.project_name
                          ? <Typography variant="body2" color="text.secondary">{entry.project_name}</Typography>
                          : <Chip label="-" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell><Typography variant="body2">{new Date(entry.date).toLocaleDateString()}</Typography></TableCell>
                      <TableCell><Chip label={`${entry.hours} hours`} color="primary" variant="outlined" /></TableCell>
                      <TableCell>
                        {entry.description
                          ? <Typography variant="body2" color="text.secondary">{entry.description}</Typography>
                          : <Chip label="No description" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleOpen(entry)} color="primary" size="small"><EditIcon /></IconButton>
                        <IconButton onClick={() => { if (window.confirm(`Delete ${entry.hours}h entry for ${entry.client_name}?`)) deleteMutation.mutate(entry.id); }} color="error" size="small"><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>No work entries found. Add your first work entry to get started.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Dialog open={open} onClose={resetForm} maxWidth="sm" fullWidth>
          <DialogTitle>{editingEntry ? 'Edit Work Entry' : 'Add New Work Entry'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <FormControl fullWidth margin="dense" required>
                <InputLabel>Client</InputLabel>
                <Select value={formData.clientId} onChange={e => updateField('clientId', Number(e.target.value))} disabled={saving}>
                  {clients.map((c: { id: number; name: string }) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="dense">
                <InputLabel>Project (Optional)</InputLabel>
                <Select value={formData.projectId} onChange={e => updateField('projectId', Number(e.target.value))} disabled={saving}>
                  <MenuItem value={0}><em>None</em></MenuItem>
                  {projects
                    .filter((p: { client_id: number }) => !formData.clientId || p.client_id === formData.clientId)
                    .map((p: { id: number; name: string }) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField margin="dense" label="Hours" type="number" fullWidth required
                inputProps={{ min: 0.01, max: 24, step: 0.01 }} value={formData.hours}
                onChange={e => updateField('hours', e.target.value)} disabled={saving} />

              <DatePicker label="Date" value={formData.date} onChange={d => d && updateField('date', d)}
                slotProps={{ textField: { fullWidth: true, margin: 'dense', required: true, disabled: saving } }} />

              <TextField margin="dense" label="Description" fullWidth multiline rows={3}
                value={formData.description} onChange={e => updateField('description', e.target.value)} disabled={saving} />
            </DialogContent>
            <DialogActions>
              <Button onClick={resetForm} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? <CircularProgress size={24} /> : (editingEntry ? 'Update' : 'Create')}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default WorkEntriesPage;
