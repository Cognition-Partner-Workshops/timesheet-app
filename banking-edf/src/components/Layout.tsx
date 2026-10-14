import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Chip,
  Divider,
  useTheme,
  alpha,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  SwapHoriz as TransferIcon,
  CheckCircle as ValidationIcon,
  VerifiedUser as VerificationIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  Notifications as NotificationsIcon,
  AccountBalance as BankIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';

const DRAWER_WIDTH = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Data Sources', icon: <StorageIcon />, path: '/sources' },
  { text: 'Data Transfer', icon: <TransferIcon />, path: '/transfer' },
  { text: 'Data Validation', icon: <ValidationIcon />, path: '/validation' },
  { text: 'Verification & Audit', icon: <VerificationIcon />, path: '/verification' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          sx={{
            bgcolor: theme.palette.primary.main,
            width: 44,
            height: 44,
          }}
        >
          <BankIcon />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Banking EDF
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Enterprise Data Framework
          </Typography>
        </Box>
      </Box>

      <Divider />

      <List sx={{ px: 1.5, py: 1, flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.text}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                px: 2,
                py: 1.2,
                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, 0.16)
                    : alpha(theme.palette.primary.main, 0.06),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                slotProps={{
                  primary: { sx: { fontWeight: isActive ? 600 : 400 } },
                }}
              />
              {isActive && (
                <Box
                  sx={{
                    width: 4,
                    height: 24,
                    borderRadius: 2,
                    bgcolor: theme.palette.primary.main,
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Chip
          label="v2.4.0 — Production"
          size="small"
          color="success"
          variant="outlined"
        />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            color="text.primary"
            sx={{ fontWeight: 600, flexGrow: 1 }}
          >
            {menuItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>

          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton onClick={toggleTheme} sx={{ mr: 1 }}>
              {mode === 'light' ? <DarkIcon /> : <LightIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton sx={{ mr: 1 }}>
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Avatar
            sx={{
              bgcolor: theme.palette.secondary.main,
              width: 36,
              height: 36,
              fontSize: 14,
            }}
          >
            DA
          </Avatar>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
            },
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
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: theme.palette.background.default,
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
