import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Switch,
  Divider,
  TextField,
  Button,
  MenuItem,
  FormControlLabel,
  useTheme,
  alpha,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Brightness4 as ThemeIcon,
  Notifications as NotifIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Speed as PerformanceIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';

const Settings: React.FC = () => {
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your Enterprise Data Framework preferences
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main }}>
                  <ThemeIcon />
                </Avatar>
                <Typography variant="h6">Appearance</Typography>
              </Box>

              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Dark Mode"
                    secondary="Switch between light and dark theme"
                  />
                  <ListItemSecondaryAction>
                    <Switch checked={mode === 'dark'} onChange={toggleTheme} />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Compact Mode"
                    secondary="Reduce spacing for denser information display"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={false} />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText primary="Language" secondary="Select your preferred language" />
                  <ListItemSecondaryAction>
                    <TextField
                      select
                      size="small"
                      defaultValue="en"
                      sx={{ width: 120 }}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Spanish</MenuItem>
                      <MenuItem value="fr">French</MenuItem>
                      <MenuItem value="de">German</MenuItem>
                    </TextField>
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha('#ED6C02', 0.12), color: '#ED6C02' }}>
                  <NotifIcon />
                </Avatar>
                <Typography variant="h6">Notifications</Typography>
              </Box>

              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Transfer Completion"
                    secondary="Notify when data transfers complete"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Validation Failures"
                    secondary="Alert on critical validation rule failures"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Pipeline Errors"
                    secondary="Immediate alerts for pipeline failures"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Email Notifications"
                    secondary="Send email summaries daily"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={false} />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha('#2E7D32', 0.12), color: '#2E7D32' }}>
                  <PerformanceIcon />
                </Avatar>
                <Typography variant="h6">Performance</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Default Batch Size"
                  type="number"
                  defaultValue={10000}
                  fullWidth
                  helperText="Number of records per batch during transfer"
                />
                <TextField
                  label="Max Parallelism"
                  type="number"
                  defaultValue={4}
                  fullWidth
                  helperText="Maximum concurrent transfer threads"
                />
                <TextField
                  label="Connection Timeout (seconds)"
                  type="number"
                  defaultValue={30}
                  fullWidth
                  helperText="Maximum wait time for database connections"
                />
                <TextField
                  label="Retry Attempts"
                  type="number"
                  defaultValue={3}
                  fullWidth
                  helperText="Number of automatic retry attempts on failure"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha('#D32F2F', 0.12), color: '#D32F2F' }}>
                  <SecurityIcon />
                </Avatar>
                <Typography variant="h6">Security & Compliance</Typography>
              </Box>

              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Enforce SSL/TLS"
                    secondary="Require encrypted connections for all sources"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="PII Auto-Masking"
                    secondary="Automatically mask PII fields during transfers"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Audit Logging"
                    secondary="Log all data operations for compliance"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Checksum Verification"
                    secondary="Generate and verify checksums after every transfer"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha('#9C27B0', 0.12), color: '#9C27B0' }}>
                  <ScheduleIcon />
                </Avatar>
                <Typography variant="h6">Scheduling</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Default Schedule"
                  select
                  fullWidth
                  defaultValue="daily"
                >
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily (2:00 AM)</MenuItem>
                  <MenuItem value="weekly">Weekly (Sunday 2:00 AM)</MenuItem>
                  <MenuItem value="monthly">Monthly (1st, 2:00 AM)</MenuItem>
                  <MenuItem value="custom">Custom Cron Expression</MenuItem>
                </TextField>
                <TextField
                  label="Timezone"
                  select
                  fullWidth
                  defaultValue="utc"
                >
                  <MenuItem value="utc">UTC</MenuItem>
                  <MenuItem value="est">US Eastern (EST)</MenuItem>
                  <MenuItem value="pst">US Pacific (PST)</MenuItem>
                  <MenuItem value="gmt">GMT</MenuItem>
                  <MenuItem value="ist">India (IST)</MenuItem>
                </TextField>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable automatic scheduled runs"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Avatar sx={{ bgcolor: alpha('#00897B', 0.12), color: '#00897B' }}>
                  <BackupIcon />
                </Avatar>
                <Typography variant="h6">Backup & Recovery</Typography>
              </Box>

              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Auto Checkpoint"
                    secondary="Create checkpoints before each transfer"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Checkpoint Retention"
                    secondary="Number of days to keep checkpoints"
                  />
                  <ListItemSecondaryAction>
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={30}
                      sx={{ width: 80 }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Auto Rollback on Failure"
                    secondary="Automatically rollback if transfer fails validation"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" color="warning" fullWidth>
                  Test Recovery Procedure
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined">Reset to Defaults</Button>
        <Button variant="contained" size="large">Save Settings</Button>
      </Box>
    </Box>
  );
};

export default Settings;
