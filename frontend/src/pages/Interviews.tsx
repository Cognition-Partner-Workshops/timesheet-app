import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, IconButton, Tooltip, Tab, Tabs, Select,
  FormControl, InputLabel, InputAdornment, Alert, Snackbar,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon,
  Event as EventIcon, PlayArrow as PlayIcon, CheckCircle as CheckIcon,
  Cancel as CancelIcon, AccessTime as TimeIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarIcon,
  VideoCall as VideoCallIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { getInterviews, createInterview, updateInterview, deleteInterview, getUsers, getPanels } from '../services/api';

interface Interview {
  id: number;
  title: string;
  description: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string;
  panel_id: number | null;
  interviewer?: { id: number; full_name: string; email: string };
  candidate?: { id: number; full_name: string; email: string };
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

interface Panel {
  id: number;
  name: string;
  description: string;
  members: { user: { full_name: string } }[];
}

const Interviews: React.FC = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [form, setForm] = useState({
    title: '',
    description: '',
    interviewer_id: '',
    candidate_id: '',
    scheduled_at: '',
    duration_minutes: 60,
    meeting_link: '',
    panel_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [interviewsRes, usersRes, panelsRes] = await Promise.all([
        getInterviews(),
        getUsers(),
        getPanels(),
      ]);
      setInterviews(interviewsRes.data);
      setUsers(usersRes.data);
      setPanels(panelsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createInterview({
        ...form,
        interviewer_id: Number(form.interviewer_id),
        candidate_id: Number(form.candidate_id),
        panel_id: form.panel_id ? Number(form.panel_id) : null,
      });
      setDialogOpen(false);
      setForm({
        title: '', description: '', interviewer_id: '', candidate_id: '',
        scheduled_at: '', duration_minutes: 60, meeting_link: '', panel_id: '',
      });
      setSnackbar({ open: true, message: 'Interview scheduled successfully!', severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to schedule interview',
        severity: 'error',
      });
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateInterview(id, { status });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await deleteInterview(id);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleJoinCall = (interview: Interview) => {
    const params = new URLSearchParams({
      title: interview.title,
      candidate: interview.candidate?.full_name || 'Candidate',
      interviewer: interview.interviewer?.full_name || 'Interviewer',
    });
    navigate(`/video-call?${params.toString()}`);
  };

  const statusTabs = ['all', 'scheduled', 'in_progress', 'completed', 'cancelled'];

  const filteredInterviews = interviews.filter((i) => {
    const matchesTab = activeTab === 0 || i.status === statusTabs[activeTab];
    const matchesSearch = i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.candidate?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.interviewer?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'scheduled': return { color: '#3b82f6', bg: '#eff6ff', icon: <CalendarIcon fontSize="small" /> };
      case 'in_progress': return { color: '#f59e0b', bg: '#fef3c7', icon: <PlayIcon fontSize="small" /> };
      case 'completed': return { color: '#10b981', bg: '#ecfdf5', icon: <CheckIcon fontSize="small" /> };
      case 'cancelled': return { color: '#ef4444', bg: '#fef2f2', icon: <CancelIcon fontSize="small" /> };
      default: return { color: '#64748b', bg: '#f1f5f9', icon: <EventIcon fontSize="small" /> };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getPanelName = (panelId: number | null) => {
    if (!panelId) return null;
    const panel = panels.find(p => p.id === panelId);
    return panel?.name || null;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Interviews
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage and track all your interview sessions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ px: 3, py: 1.2 }}
        >
          Schedule Interview
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              placeholder="Search interviews..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1, maxWidth: 400 }}
            />
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.8rem', fontWeight: 600 },
              }}
            >
              <Tab label="All" />
              <Tab label="Scheduled" />
              <Tab label="In Progress" />
              <Tab label="Completed" />
              <Tab label="Cancelled" />
            </Tabs>
          </Box>
        </CardContent>
      </Card>

      {/* Interview Cards */}
      <Grid container spacing={3}>
        {filteredInterviews.map((interview) => {
          const config = getStatusConfig(interview.status);
          const panelName = getPanelName(interview.panel_id);
          return (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={interview.id}>
              <Card sx={{
                height: '100%',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' },
                transition: 'all 0.3s ease',
              }}>
                <CardContent sx={{ p: 3 }}>
                  {/* Status & Actions */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        icon={config.icon}
                        label={interview.status.replace('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor: config.bg, color: config.color,
                          fontWeight: 600, textTransform: 'capitalize',
                          '& .MuiChip-icon': { color: config.color },
                        }}
                      />
                      {panelName && (
                        <Chip
                          icon={<GroupsIcon sx={{ fontSize: 14 }} />}
                          label={panelName}
                          size="small"
                          sx={{ bgcolor: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Box>
                      {(interview.status === 'scheduled' || interview.status === 'in_progress') && (
                        <Tooltip title="Join Video Call">
                          <IconButton
                            size="small"
                            onClick={() => handleJoinCall(interview)}
                            sx={{ color: '#6366f1' }}
                          >
                            <VideoCallIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {interview.status === 'scheduled' && (
                        <Tooltip title="Start Interview">
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(interview.id, 'in_progress')}
                            sx={{ color: '#10b981' }}
                          >
                            <PlayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {interview.status === 'in_progress' && (
                        <Tooltip title="Complete Interview">
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(interview.id, 'completed')}
                            sx={{ color: '#3b82f6' }}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(interview.id)}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Title */}
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.3 }}>
                    {interview.title}
                  </Typography>
                  {interview.description && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }} noWrap>
                      {interview.description}
                    </Typography>
                  )}

                  {/* Participants */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{
                        width: 32, height: 32, fontSize: '0.75rem',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      }}>
                        {interview.interviewer?.full_name?.charAt(0) || 'I'}
                      </Avatar>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Interviewer
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {interview.interviewer?.full_name || 'TBD'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{
                        width: 32, height: 32, fontSize: '0.75rem',
                        background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                      }}>
                        {interview.candidate?.full_name?.charAt(0) || 'C'}
                      </Avatar>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Candidate
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {interview.candidate?.full_name || 'TBD'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Schedule Info */}
                  <Box sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    pt: 2, borderTop: '1px solid', borderColor: 'divider',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(interview.scheduled_at)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {interview.duration_minutes} min
                      </Typography>
                    </Box>
                  </Box>

                  {/* Join Call Button */}
                  {(interview.status === 'scheduled' || interview.status === 'in_progress') && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<VideoCallIcon />}
                      onClick={() => handleJoinCall(interview)}
                      sx={{
                        mt: 2, borderColor: '#6366f1', color: '#6366f1',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#6366f1', color: '#fff', borderColor: '#6366f1' },
                      }}
                    >
                      Join Video Call
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {filteredInterviews.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <EventIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            No interviews found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Schedule your first interview to get started
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Schedule Interview
          </Button>
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Schedule New Interview</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth label="Interview Title" margin="dense"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            fullWidth label="Description" margin="dense" multiline rows={2}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Interviewer</InputLabel>
            <Select
              value={form.interviewer_id}
              label="Interviewer"
              onChange={(e) => setForm({ ...form, interviewer_id: e.target.value as string })}
            >
              {users.filter(u => u.role === 'interviewer' || u.role === 'admin').map(u => (
                <MenuItem key={u.id} value={u.id}>{u.full_name} ({u.email})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Candidate</InputLabel>
            <Select
              value={form.candidate_id}
              label="Candidate"
              onChange={(e) => setForm({ ...form, candidate_id: e.target.value as string })}
            >
              {users.filter(u => u.role === 'candidate').map(u => (
                <MenuItem key={u.id} value={u.id}>{u.full_name} ({u.email})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Interview Panel (Optional)</InputLabel>
            <Select
              value={form.panel_id}
              label="Interview Panel (Optional)"
              onChange={(e) => setForm({ ...form, panel_id: e.target.value as string })}
            >
              <MenuItem value="">None</MenuItem>
              {panels.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} ({p.members.length} members)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth label="Scheduled At" type="datetime-local" margin="dense"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth label="Duration (minutes)" type="number" margin="dense"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
          />
          <TextField
            fullWidth label="Meeting Link (optional)" margin="dense"
            value={form.meeting_link}
            onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.title || !form.interviewer_id || !form.candidate_id}>
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Interviews;
