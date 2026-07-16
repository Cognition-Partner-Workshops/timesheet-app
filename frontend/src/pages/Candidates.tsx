import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Chip,
  TextField, InputAdornment, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Alert, Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon, Email as EmailIcon, Phone as PhoneIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { getUsers, getInterviews, createUser } from '../services/api';

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  phone: string;
  created_at: string;
  is_active: boolean;
}

interface Interview {
  id: number;
  candidate_id: number;
  status: string;
}

const Candidates: React.FC = () => {
  const [candidates, setCandidates] = useState<User[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [form, setForm] = useState({
    full_name: '', email: '', password: 'password123', role: 'candidate', phone: '',
  });

  const fetchData = async () => {
    try {
      const [usersRes, interviewsRes] = await Promise.all([
        getUsers('candidate'),
        getInterviews(),
      ]);
      setCandidates(usersRes.data);
      setInterviews(interviewsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCandidate = async () => {
    try {
      await createUser(form);
      setDialogOpen(false);
      setForm({ full_name: '', email: '', password: 'password123', role: 'candidate', phone: '' });
      setSnackbar({ open: true, message: 'Candidate added successfully!', severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to add candidate',
        severity: 'error',
      });
    }
  };

  const getCandidateInterviews = (candidateId: number) => {
    return interviews.filter(i => i.candidate_id === candidateId);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f472b6)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'linear-gradient(135deg, #f59e0b, #fbbf24)',
      'linear-gradient(135deg, #3b82f6, #60a5fa)',
      'linear-gradient(135deg, #ef4444, #f87171)',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Candidates
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Track and manage all candidates in your pipeline
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ px: 3, py: 1.2 }}
        >
          Add Candidate
        </Button>
      </Box>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <TextField
            fullWidth
            placeholder="Search candidates by name or email..."
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
          />
        </CardContent>
      </Card>

      {/* Candidate Cards */}
      <Grid container spacing={3}>
        {filteredCandidates.map((candidate) => {
          const candidateInterviews = getCandidateInterviews(candidate.id);
          const completedCount = candidateInterviews.filter(i => i.status === 'completed').length;
          const scheduledCount = candidateInterviews.filter(i => i.status === 'scheduled').length;

          return (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={candidate.id}>
              <Card sx={{
                height: '100%',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' },
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Avatar sx={{
                      width: 56, height: 56,
                      background: getAvatarColor(candidate.full_name),
                      fontSize: '1.3rem', fontWeight: 700,
                    }}>
                      {candidate.full_name.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                    <Box>
                      <Chip
                        label={candidate.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          bgcolor: candidate.is_active ? '#ecfdf5' : '#fef2f2',
                          color: candidate.is_active ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {candidate.full_name}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {candidate.email}
                      </Typography>
                    </Box>
                    {candidate.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {candidate.phone}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Interview Stats */}
                  <Box sx={{
                    display: 'flex', gap: 2, pt: 2,
                    borderTop: '1px solid', borderColor: 'divider',
                  }}>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#6366f1' }}>
                        {candidateInterviews.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Total
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1, borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>
                        {completedCount}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Completed
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                        {scheduledCount}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Scheduled
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {filteredCandidates.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PersonAddIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            No candidates found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Add your first candidate to get started
          </Typography>
        </Box>
      )}

      {/* Add Candidate Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Add New Candidate</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth label="Full Name" margin="dense" required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <TextField
            fullWidth label="Email Address" margin="dense" type="email" required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            fullWidth label="Phone Number" margin="dense"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            fullWidth label="Role" margin="dense" select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <MenuItem value="candidate">Candidate</MenuItem>
            <MenuItem value="interviewer">Interviewer</MenuItem>
          </TextField>
          <TextField
            fullWidth label="Password" margin="dense" type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            helperText="Default password for the new account"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateCandidate}
            disabled={!form.full_name || !form.email}
          >
            Add Candidate
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

export default Candidates;
