import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  CardActions,
  Grid,
  InputAdornment,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Note } from '../types/api';

const NotesPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    category: '',
    pinned: false,
  });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const queryClient = useQueryClient();

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes', searchQuery, filterTag],
    queryFn: () => {
      const params: { search?: string; tag?: string } = {};
      if (searchQuery) params.search = searchQuery;
      if (filterTag) params.tag = filterTag;
      return apiClient.getNotes(params);
    },
  });

  const createMutation = useMutation({
    mutationFn: (noteData: { title: string; content?: string; tags?: string[]; category?: string; pinned?: boolean }) =>
      apiClient.createNote(noteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create note');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; tags?: string[]; category?: string; pinned?: boolean } }) =>
      apiClient.updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update note');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete note');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      apiClient.updateNote(id, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const notes: Note[] = notesData?.notes || [];

  const allTags = Array.from(new Set(notes.flatMap((n: Note) => n.tags || [])));

  const handleOpen = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        content: note.content || '',
        tags: (note.tags || []).join(', '),
        category: note.category || '',
        pinned: note.pinned || false,
      });
    } else {
      setEditingNote(null);
      setFormData({ title: '', content: '', tags: '', category: '', pinned: false });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingNote(null);
    setFormData({ title: '', content: '', tags: '', category: '', pinned: false });
    setError('');
  };

  const parseTags = (tagsStr: string): string[] => {
    return tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Note title is required');
      return;
    }

    const tags = parseTags(formData.tags);

    if (editingNote) {
      updateMutation.mutate({
        id: editingNote._id,
        data: {
          title: formData.title,
          content: formData.content || undefined,
          tags,
          category: formData.category || undefined,
          pinned: formData.pinned,
        },
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        content: formData.content || undefined,
        tags,
        category: formData.category || undefined,
        pinned: formData.pinned,
      });
    }
  };

  const handleDelete = (note: Note) => {
    if (window.confirm(`Are you sure you want to delete "${note.title}"?`)) {
      deleteMutation.mutate(note._id);
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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Notes</Typography>
          <Typography variant="body2" color="text.secondary">
            Powered by NeDB (document database)
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Add Note
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 250 }}
          />
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
            {filterTag && (
              <Chip
                label={`Tag: ${filterTag}`}
                onDelete={() => setFilterTag('')}
                color="primary"
                size="small"
              />
            )}
            {allTags
              .filter((tag) => tag !== filterTag)
              .map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onClick={() => setFilterTag(tag)}
                  size="small"
                  variant="outlined"
                />
              ))}
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={2}>
        {notes.length > 0 ? (
          notes.map((note: Note) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={note._id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: note.pinned ? '4px solid' : 'none',
                  borderColor: 'primary.main',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" gutterBottom noWrap sx={{ maxWidth: '80%' }}>
                      {note.title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() =>
                        togglePinMutation.mutate({ id: note._id, pinned: !note.pinned })
                      }
                    >
                      {note.pinned ? (
                        <PushPinIcon fontSize="small" color="primary" />
                      ) : (
                        <PushPinOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                  {note.category && (
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      {note.category}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      whiteSpace: 'pre-wrap',
                      mb: 1,
                    }}
                  >
                    {note.content || 'No content'}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {(note.tags || []).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        onClick={() => setFilterTag(tag)}
                      />
                    ))}
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </Typography>
                  <Box>
                    <IconButton onClick={() => handleOpen(note)} color="primary" size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(note)} color="error" size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid size={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No notes found. Create your first note to get started.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNote ? 'Edit Note' : 'Add New Note'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
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
              label="Category"
              fullWidth
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <TextField
              margin="dense"
              label="Content"
              fullWidth
              multiline
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <TextField
              margin="dense"
              label="Tags (comma-separated)"
              fullWidth
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              helperText="e.g. meeting, important, follow-up"
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.pinned}
                  onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              }
              label="Pin this note"
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleClose}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={24} />
              ) : editingNote ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default NotesPage;
