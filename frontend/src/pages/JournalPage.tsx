import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Link,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
  Newspaper as NewspaperIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../api/client';
import { type JournalEntry } from '../types/api';

const JournalPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    source: '',
    sourceUrl: '',
    publishedDate: null as Date | null,
  });
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: journalData, isLoading } = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => apiClient.getJournalEntries(),
  });

  const seedMutation = useMutation({
    mutationFn: () => apiClient.seedJournalNews(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to seed news');
    },
  });

  const createMutation = useMutation({
    mutationFn: (entryData: { title: string; content: string; source?: string; sourceUrl?: string; publishedDate?: string }) =>
      apiClient.createJournalEntry(entryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create journal entry');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; content?: string; source?: string; sourceUrl?: string; publishedDate?: string } }) =>
      apiClient.updateJournalEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update journal entry');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete journal entry');
    },
  });

  const journalEntries = journalData?.journalEntries || [];

  const handleOpen = (entry?: JournalEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        title: entry.title,
        content: entry.content,
        source: entry.source || '',
        sourceUrl: entry.source_url || '',
        publishedDate: entry.published_date ? new Date(entry.published_date) : null,
      });
    } else {
      setEditingEntry(null);
      setFormData({
        title: '',
        content: '',
        source: '',
        sourceUrl: '',
        publishedDate: null,
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingEntry(null);
    setFormData({
      title: '',
      content: '',
      source: '',
      sourceUrl: '',
      publishedDate: null,
    });
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    const entryData = {
      title: formData.title,
      content: formData.content,
      source: formData.source || undefined,
      sourceUrl: formData.sourceUrl || undefined,
      publishedDate: formData.publishedDate ? formData.publishedDate.toISOString().split('T')[0] : undefined,
    };

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        data: entryData,
      });
    } else {
      createMutation.mutate(entryData);
    }
  };

  const handleDelete = (entry: JournalEntry) => {
    if (window.confirm(`Are you sure you want to delete "${entry.title}"?`)) {
      deleteMutation.mutate(entry.id);
    }
  };

  if (isLoading) {
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
          <Typography variant="h4">Journal</Typography>
          <Box display="flex" gap={1}>
            {journalEntries.length === 0 && (
              <Button
                variant="outlined"
                startIcon={<NewspaperIcon />}
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? 'Loading...' : 'Load Riyadh Bank News'}
              </Button>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
              Add Entry
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {journalEntries.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <NewspaperIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No journal entries yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Click &quot;Load Riyadh Bank News&quot; to populate your journal with the latest news, or add your own entries.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {journalEntries.map((entry: JournalEntry) => (
              <Grid size={{ xs: 12, md: 6 }} key={entry.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {entry.title}
                    </Typography>
                    <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                      {entry.source && (
                        <Chip label={entry.source} size="small" color="primary" variant="outlined" />
                      )}
                      {entry.published_date && (
                        <Chip
                          label={new Date(entry.published_date).toLocaleDateString()}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {entry.content}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Box>
                      {entry.source_url && (
                        <Link href={entry.source_url} target="_blank" rel="noopener noreferrer">
                          <Button size="small" startIcon={<OpenInNewIcon />}>
                            Source
                          </Button>
                        </Link>
                      )}
                    </Box>
                    <Box>
                      <IconButton
                        onClick={() => handleOpen(entry)}
                        color="primary"
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(entry)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingEntry ? 'Edit Journal Entry' : 'Add New Journal Entry'}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                margin="dense"
                label="Title"
                fullWidth
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />

              <TextField
                margin="dense"
                label="Content"
                fullWidth
                required
                multiline
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />

              <TextField
                margin="dense"
                label="Source"
                fullWidth
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />

              <TextField
                margin="dense"
                label="Source URL"
                fullWidth
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />

              <DatePicker
                label="Published Date"
                value={formData.publishedDate}
                onChange={(date) => setFormData({ ...formData, publishedDate: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'dense',
                    disabled: createMutation.isPending || updateMutation.isPending,
                  },
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <CircularProgress size={24} />
                ) : (
                  editingEntry ? 'Update' : 'Create'
                )}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default JournalPage;
