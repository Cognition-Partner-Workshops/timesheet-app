import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, IconButton, Avatar, Badge,
  Tooltip, Divider, alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  QuestionAnswer as QuestionIcon,
  People as PeopleIcon,
  Groups as GroupsIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const drawerWidth = 280;
const drawerCollapsedWidth = 72;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Interviews', icon: <EventIcon />, path: '/interviews' },
  { text: 'Questions', icon: <QuestionIcon />, path: '/questions' },
  { text: 'Candidates', icon: <PeopleIcon />, path: '/candidates' },
  { text: 'Panels', icon: <GroupsIcon />, path: '/panels' },
  { text: 'Code Editor', icon: <CodeIcon />, path: '/code-editor' },
  { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
];

const Layout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const currentWidth = drawerOpen ? drawerWidth : drawerCollapsedWidth;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: currentWidth,
          flexShrink: 0,
          transition: 'width 0.3s ease',
          '& .MuiDrawer-paper': {
            width: currentWidth,
            boxSizing: 'border-box',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
            color: '#e0e7ff',
            border: 'none',
          },
        }}
      >
        {/* Logo Area */}
        <Box sx={{
          p: 2, display: 'flex', alignItems: 'center',
          justifyContent: drawerOpen ? 'space-between' : 'center',
          minHeight: 72,
        }}>
          {drawerOpen && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 2,
                background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1.2rem', color: '#fff',
              }}>
                IH
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.2 }}>
                  InterviewHub
                </Typography>
                <Typography variant="caption" sx={{ color: '#a5b4fc', fontSize: '0.65rem' }}>
                  Technical Interview Platform
                </Typography>
              </Box>
            </Box>
          )}
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)} sx={{ color: '#c7d2fe' }}>
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

        {/* Navigation Items */}
        <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <ListItemButton
                key={item.text}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1.2,
                  px: drawerOpen ? 2 : 1.5,
                  justifyContent: drawerOpen ? 'flex-start' : 'center',
                  bgcolor: isActive ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                  color: isActive ? '#c7d2fe' : '#94a3b8',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(129, 140, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                    color: '#e0e7ff',
                  },
                  position: 'relative',
                  '&::before': isActive ? {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: 4,
                    bgcolor: '#818cf8',
                  } : {},
                }}
              >
                <ListItemIcon sx={{
                  color: isActive ? '#818cf8' : '#94a3b8',
                  minWidth: drawerOpen ? 40 : 'unset',
                }}>
                  {item.icon}
                </ListItemIcon>
                {drawerOpen && (
                  <ListItemText
                    primary={item.text}
                    slotProps={{ primary: { style: { fontSize: '0.875rem', fontWeight: isActive ? 600 : 500 } } }}
                  />
                )}
              </ListItemButton>
            );
          })}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

        {/* User Section */}
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              justifyContent: drawerOpen ? 'flex-start' : 'center',
              color: '#94a3b8',
              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: drawerOpen ? 40 : 'unset' }}>
              <LogoutIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary="Logout" slotProps={{ primary: { style: { fontSize: '0.875rem' } } }} />}
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: alpha('#ffffff', 0.8),
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ justifyContent: 'flex-end', gap: 1 }}>
            <Tooltip title="Notifications">
              <IconButton>
                <Badge badgeContent={3} color="error" variant="dot">
                  <NotificationsIcon sx={{ color: 'text.secondary' }} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton>
                <SettingsIcon sx={{ color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
            <Avatar
              sx={{
                width: 36, height: 36, ml: 1,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                fontSize: '0.85rem', fontWeight: 700,
              }}
            >
              SJ
            </Avatar>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
