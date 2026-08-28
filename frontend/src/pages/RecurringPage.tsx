import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, FormControlLabel, Checkbox, Chip,
  Alert, CircularProgress, FormGroup,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, PlayArrow as GenerateIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

interface Template {
  id: number;
  client_id: number;
  client_name: string;
  hours: number;
  description: string | null;
  frequency: string;
  days_of_week: number;
  start_date: string;
  end_date: string | null;
  active: number;
  created_at: string;
}

interface GeneratedEntry {
  date: string;
  clientId: number;
  clientName: string;
  hours: number;
  description: string | null;
}

interface Client {
  id: number;
  name: string;
}

const DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 4 },
  { label: 'Thu', value: 8 },
  { label: 'Fri', value: 16 },
  { label: 'Sat', value: 32 },
  { label: 'Sun', value: 64 },
];

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];

function daysOfWeekLabel(bitmask: number): string {
  return DAYS.filter(d => (bitmask & d.value) !== 0).map(d => d.label).join(', ');
}

const RecurringPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTemplateId, setGenerateTemplateId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState<GeneratedEntry[] | null>(null);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  // Form state
  const [formClientId, setFormClientId] = useState<number | ''>('');
  const [formHours, setFormHours] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFrequency, setFormFrequency] = useState('weekly');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState(31); // Mon-Fri
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['recurring-templates'],
    queryFn: () => apiClient.getRecurringTemplates(),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const templates: Template[] = templatesData?.templates || [];
  const clients: Client[] = clientsData?.clients || [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createRecurringTemplate>[0]) =>
      apiClient.createRecurringTemplate(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof apiClient.updateRecurringTemplate>[1] }) =>
      apiClient.updateRecurringTemplate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteRecurringTemplate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }); },
  });

  const generateMutation = useMutation({
    mutationFn: ({ id, from, to }: { id: number; from: string; to: string }) =>
      apiClient.generateRecurringEntries(id, from, to),
    onSuccess: (data) => { setPreview(data.entries); },
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, from, to }: { id: number; from: string; to: string }) =>
      apiClient.applyRecurringEntries(id, from, to),
    onSuccess: (data) => {
      setApplySuccess(data.message);
      setPreview(null);
      setGenerateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['work-entries'] });
    },
    onError: () => { setApplyError('Failed to apply entries'); },
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormClientId('');
    setFormHours('');
    setFormDescription('');
    setFormFrequency('weekly');
    setFormDaysOfWeek(31);
    setFormStartDate('');
    setFormEndDate('');
    setDialogOpen(true);
  };

  const openEditDialog = (t: Template) => {
    setEditingTemplate(t);
    setFormClientId(t.client_id);
    setFormHours(String(t.hours));
    setFormDescription(t.description || '');
    setFormFrequency(t.frequency);
    setFormDaysOfWeek(t.days_of_week);
    setFormStartDate(t.start_date);
    setFormEndDate(t.end_date || '');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      clientId: Number(formClientId),
      hours: Number(formHours),
      description: formDescription,
      frequency: formFrequency,
      daysOfWeek: formDaysOfWeek,
      startDate: formStartDate,
      endDate: formEndDate || null,
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openGenerateDialog = (templateId: number) => {
    setGenerateTemplateId(templateId);
    setFromDate('');
    setToDate('');
    setPreview(null);
    setApplyError('');
    setApplySuccess('');
    setGenerateDialogOpen(true);
  };

  const handleGenerate = () => {
    if (generateTemplateId && fromDate && toDate) {
      generateMutation.mutate({ id: generateTemplateId, from: fromDate, to: toDate });
    }
  };

  const handleApply = () => {
    if (generateTemplateId && fromDate && toDate) {
      applyMutation.mutate({ id: generateTemplateId, from: fromDate, to: toDate });
    }
  };

  const toggleDay = (dayValue: number) => {
    setFormDaysOfWeek(prev => prev ^ dayValue);
  };

  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Recurring Templates</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Template
        </Button>
      </Box>

      {applySuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setApplySuccess('')}>{applySuccess}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Days</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.client_name}</TableCell>
                <TableCell>{t.hours}</TableCell>
                <TableCell>{t.frequency}</TableCell>
                <TableCell>{daysOfWeekLabel(t.days_of_week)}</TableCell>
                <TableCell>
                  <Chip label={t.active ? 'Active' : 'Inactive'} color={t.active ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openGenerateDialog(t.id)} title="Generate entries">
                    <GenerateIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => openEditDialog(t)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => deleteMutation.mutate(t.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">No templates yet. Create one to get started.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select label="Client" value={formClientId} fullWidth
              onChange={(e) => setFormClientId(Number(e.target.value))}
            >
              {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField
              label="Hours" type="number" value={formHours} fullWidth
              onChange={(e) => setFormHours(e.target.value)}
              inputProps={{ min: 0.25, max: 24, step: 0.25 }}
            />
            <TextField
              label="Description" value={formDescription} fullWidth
              onChange={(e) => setFormDescription(e.target.value)}
            />
            <TextField
              select label="Frequency" value={formFrequency} fullWidth
              onChange={(e) => setFormFrequency(e.target.value)}
            >
              {FREQUENCIES.map((f) => <MenuItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</MenuItem>)}
            </TextField>
            <FormGroup row>
              {DAYS.map((day) => (
                <FormControlLabel
                  key={day.value}
                  control={
                    <Checkbox
                      checked={(formDaysOfWeek & day.value) !== 0}
                      onChange={() => toggleDay(day.value)}
                      size="small"
                    />
                  }
                  label={day.label}
                />
              ))}
            </FormGroup>
            <TextField
              label="Start Date" type="date" value={formStartDate} fullWidth
              onChange={(e) => setFormStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End Date (optional)" type="date" value={formEndDate} fullWidth
              onChange={(e) => setFormEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!formClientId || !formHours || !formStartDate || !formFrequency}>
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate Work Entries</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, mb: 2 }}>
            <TextField
              label="From" type="date" value={fromDate} fullWidth
              onChange={(e) => setFromDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="To" type="date" value={toDate} fullWidth
              onChange={(e) => setToDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button variant="outlined" onClick={handleGenerate} disabled={!fromDate || !toDate}>
              Preview
            </Button>
          </Box>
          {applyError && <Alert severity="error" sx={{ mb: 2 }}>{applyError}</Alert>}
          {generateMutation.isPending && <CircularProgress size={24} />}
          {preview && (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{preview.length} entries will be created:</Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.clientName}</TableCell>
                        <TableCell>{entry.hours}</TableCell>
                        <TableCell>{entry.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
          {preview && preview.length > 0 && (
            <Button variant="contained" color="success" onClick={handleApply} disabled={applyMutation.isPending}>
              Confirm & Create Entries
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecurringPage;
