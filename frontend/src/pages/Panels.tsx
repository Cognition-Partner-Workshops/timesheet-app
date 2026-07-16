import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Tooltip, Alert, Snackbar,
  Checkbox, List, ListItemButton, ListItemIcon, ListItemText, ListItemAvatar,
} from '@mui/material';
import {
  Add as AddIcon, Groups as GroupsIcon, Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { getPanels, createPanel, deletePanel, getUsers } from '../services/api';

interface PanelMember {
  id: number;
  user_id: number;
  role_in_panel: string;
  user: {
    id: number;
    full_name: string;
    email: string;
    role: string;
  };
}

interface Panel {
  id: number;
  name: string;
  description: string;
  created_at: string;
  members: PanelMember[];
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

const Panels: React.FC = () => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      const [panelsRes, usersRes] = await Promise.all([
        getPanels(),
        getUsers(),
      ]);
      setPanels(panelsRes.data);
      setUsers(usersRes.data.filter((u: User) => u.role !== 'candidate'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    try {
      await createPanel({
        ...form,
        member_ids: selectedMembers,
      });
      setDialogOpen(false);
      setForm({ name: '', description: '' });
      setSelectedMembers([]);
      setSnackbar({ open: true, message: 'Panel created successfully!', severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to create panel',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this panel?')) {
      try {
        await deletePanel(id);
        setSnackbar({ open: true, message: 'Panel deleted', severity: 'success' });
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleMember = (userId: number) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f472b6)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'linear-gradient(135deg, #f59e0b, #fbbf24)',
      'linear-gradient(135deg, #3b82f6, #60a5fa)',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Interview Panels
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage interviewer panels for structured evaluations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ px: 3, py: 1.2 }}
        >
          Create Panel
        </Button>
      </Box>

      {/* Panel Cards */}
      <Grid container spacing={3}>
        {panels.map((panel) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={panel.id}>
            <Card sx={{
              height: '100%',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' },
              transition: 'all 0.3s ease',
            }}>
              <CardContent sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{
                      width: 44, height: 44,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    }}>
                      <GroupsIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {panel.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {panel.members.length} member{panel.members.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>
                  <Tooltip title="Delete Panel">
                    <IconButton size="small" onClick={() => handleDelete(panel.id)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {panel.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                    {panel.description}
                  </Typography>
                )}

                {/* Members */}
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Panel Members
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {panel.members.map((member) => (
                    <Box key={member.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, borderRadius: 2, bgcolor: '#f8fafc',
                    }}>
                      <Avatar sx={{
                        width: 32, height: 32, fontSize: '0.75rem',
                        background: getAvatarColor(member.user.full_name),
                      }}>
                        {member.user.full_name.split(' ').map(n => n[0]).join('')}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {member.user.full_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {member.user.email}
                        </Typography>
                      </Box>
                      <Chip
                        icon={member.role_in_panel === 'lead' ? <StarIcon sx={{ fontSize: 14 }} /> : undefined}
                        label={member.role_in_panel}
                        size="small"
                        sx={{
                          bgcolor: member.role_in_panel === 'lead' ? '#fef3c7' : '#f1f5f9',
                          color: member.role_in_panel === 'lead' ? '#d97706' : '#64748b',
                          fontWeight: 600, fontSize: '0.7rem',
                          textTransform: 'capitalize',
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {panels.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <GroupsIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            No panels created yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
            Create interviewer panels to organize your evaluation process
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Create Panel
          </Button>
        </Box>
      )}

      {/* Create Panel Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Create Interview Panel</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth label="Panel Name" margin="dense" required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Frontend Engineering Panel"
          />
          <TextField
            fullWidth label="Description" margin="dense" multiline rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the panel's focus area..."
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            Select Panel Members
          </Typography>
          <Card variant="outlined" sx={{ maxHeight: 250, overflow: 'auto' }}>
            <List dense>
              {users.map((user) => (
                <ListItemButton key={user.id} onClick={() => toggleMember(user.id)} dense>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={selectedMembers.includes(user.id)}
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{
                      width: 28, height: 28, fontSize: '0.7rem',
                      background: getAvatarColor(user.full_name),
                    }}>
                      {user.full_name.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.full_name}
                    secondary={`${user.email} · ${user.role}`}
                    slotProps={{
                      primary: { sx: { fontWeight: 600, fontSize: '0.85rem' } },
                      secondary: { sx: { fontSize: '0.75rem' } },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Card>
          {selectedMembers.length > 0 && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => { setDialogOpen(false); setSelectedMembers([]); }} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.name}
          >
            Create Panel
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

export default Panels;
