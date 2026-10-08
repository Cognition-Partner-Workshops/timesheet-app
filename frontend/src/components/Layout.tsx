import React, { type ReactNode } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  Logout as LogoutIcon,
  Download as DownloadIcon,
  DeleteForever as DeleteForeverIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';

const drawerWidth = 240;

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [privacyError, setPrivacyError] = React.useState('');

  const exportMutation = useMutation({
    mutationFn: () => apiClient.exportMyData(),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-data-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: () => setPrivacyError('Failed to export your data'),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => apiClient.deleteMyAccount(),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      logout();
      navigate('/login');
    },
    onError: () => setPrivacyError('Failed to delete your account'),
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Clients', icon: <BusinessIcon />, path: '/clients' },
    { text: 'Work Entries', icon: <AssignmentIcon />, path: '/work-entries' },
    { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Time Tracker
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List subheader={<Typography variant="overline" sx={{ px: 2 }}>Privacy</Typography>}>
        <ListItem disablePadding>
          <ListItemButton onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <ListItemIcon><DownloadIcon /></ListItemIcon>
            <ListItemText primary="Download My Data" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setDeleteDialogOpen(true)}>
            <ListItemIcon><DeleteForeverIcon color="error" /></ListItemIcon>
            <ListItemText primary="Delete My Account" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Time Tracker'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">{user?.email}</Typography>
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.email?.charAt(0).toUpperCase()}
            </Avatar>
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={logout}
              size="small"
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {privacyError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPrivacyError('')}>
            {privacyError}
          </Alert>
        )}
        {children}
      </Box>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes your account, all clients and all work entries. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteAccountMutation.mutate()}
            disabled={deleteAccountMutation.isPending}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout;
