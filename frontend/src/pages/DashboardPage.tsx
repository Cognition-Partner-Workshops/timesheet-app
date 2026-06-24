import React, { useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Paper,
  useTheme,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../api/client';
import { type WorkEntry, type Client } from '../types/api';

const CHART_COLORS = ['#1976d2', '#388e3c', '#f57c00', '#9c27b0', '#e91e63', '#00bcd4', '#ff5722', '#795548'];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const { data: workEntriesData } = useQuery({
    queryKey: ['workEntries'],
    queryFn: () => apiClient.getWorkEntries(),
  });

  const clients: Client[] = clientsData?.clients || [];
  const workEntries: WorkEntry[] = workEntriesData?.workEntries || [];

  const totalHours = workEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const recentEntries = workEntries.slice(0, 5);

  // Hours per client (bar chart)
  const hoursPerClient = useMemo(() => {
    const map = new Map<string, number>();
    workEntries.forEach((entry) => {
      const name = entry.client_name || `Client ${entry.client_id}`;
      map.set(name, (map.get(name) || 0) + entry.hours);
    });
    return Array.from(map.entries())
      .map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(2)) }))
      .sort((a, b) => b.hours - a.hours);
  }, [workEntries]);

  // Helper to normalize date field (can be epoch number or ISO string)
  const toDateString = (date: string | number): string => {
    if (typeof date === 'number') {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return String(date).split('T')[0];
  };

  // Hours over time - daily, grouped into last 30 days (line chart)
  const hoursOverTime = useMemo(() => {
    if (workEntries.length === 0) return [];
    const map = new Map<string, number>();
    workEntries.forEach((entry) => {
      const dateStr = toDateString(entry.date as string | number);
      map.set(dateStr, (map.get(dateStr) || 0) + entry.hours);
    });
    return Array.from(map.entries())
      .map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [workEntries]);

  // Work distribution by day of week (bar chart)
  const hoursByDayOfWeek = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    workEntries.forEach((entry) => {
      const d = typeof entry.date === 'number' ? new Date(entry.date) : new Date(entry.date);
      const day = d.getDay();
      totals[day] += entry.hours;
    });
    return days.map((name, i) => ({ name, hours: parseFloat(totals[i].toFixed(2)) }));
  }, [workEntries]);

  // Client distribution (pie chart)
  const clientDistribution = useMemo(() => {
    const map = new Map<string, number>();
    workEntries.forEach((entry) => {
      const name = entry.client_name || `Client ${entry.client_id}`;
      map.set(name, (map.get(name) || 0) + entry.hours);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [workEntries]);

  const statsCards = [
    {
      title: 'Total Clients',
      value: clients.length,
      icon: <BusinessIcon />,
      color: theme.palette.primary.main,
      action: () => navigate('/clients'),
    },
    {
      title: 'Total Work Entries',
      value: workEntries.length,
      icon: <AssignmentIcon />,
      color: theme.palette.success.main,
      action: () => navigate('/work-entries'),
    },
    {
      title: 'Total Hours',
      value: totalHours.toFixed(2),
      icon: <AssessmentIcon />,
      color: theme.palette.warning.main,
      action: () => navigate('/reports'),
    },
  ];

  const chartTextColor = theme.palette.text.secondary;

  const hasData = workEntries.length > 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => (
          // @ts-expect-error - MUI Grid item prop type issue
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={stat.action}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={3}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      backgroundColor: stat.color,
                      borderRadius: 1,
                      p: 1,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      {hasData && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Hours per Client */}
          {/* @ts-expect-error - MUI Grid item prop type issue */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hours per Client
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursPerClient} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 12 }} />
                  <YAxis tick={{ fill: chartTextColor }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                  />
                  <Bar dataKey="hours" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Hours Over Time */}
          {/* @ts-expect-error - MUI Grid item prop type issue */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hours Over Time (Last 30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hoursOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: chartTextColor, fontSize: 11 }}
                    tickFormatter={(val: string) => {
                      const parts = val.split('-');
                      if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
                      return val;
                    }}
                  />
                  <YAxis tick={{ fill: chartTextColor }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                    labelFormatter={(label: string) => {
                      const parts = label.split('-');
                      if (parts.length === 3) {
                        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).toLocaleDateString();
                      }
                      return label;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke={theme.palette.secondary.main}
                    strokeWidth={2}
                    dot={{ r: 4, fill: theme.palette.secondary.main }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Hours by Day of Week */}
          {/* @ts-expect-error - MUI Grid item prop type issue */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hours by Day of Week
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursByDayOfWeek} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="name" tick={{ fill: chartTextColor }} />
                  <YAxis tick={{ fill: chartTextColor }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {hoursByDayOfWeek.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index >= 1 && index <= 5 ? theme.palette.info.main : theme.palette.grey[400]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Client Distribution Pie Chart */}
          {/* @ts-expect-error - MUI Grid item prop type issue */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Time Distribution by Client
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={clientDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {clientDistribution.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                    formatter={(value: number) => [`${value} hours`, 'Hours']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Recent Entries & Quick Actions */}
      <Grid container spacing={3}>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={3}>
              <Typography variant="h6">Recent Work Entries</Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => navigate('/work-entries')}
                sx={{ flexShrink: 0 }}
              >
                Add Entry
              </Button>
            </Box>
            {recentEntries.length > 0 ? (
              recentEntries.map((entry) => (
                <Box key={entry.id} sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle1">{entry.client_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.hours} hours - {new Date(entry.date).toLocaleDateString()}
                  </Typography>
                  {entry.description && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {entry.description}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography color="text.secondary">No work entries yet</Typography>
            )}
          </Paper>
        </Grid>

        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>
              Quick Actions
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/clients')}
                fullWidth
              >
                Add Client
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/work-entries')}
                fullWidth
              >
                Add Work Entry
              </Button>
              <Button
                variant="outlined"
                startIcon={<AssessmentIcon />}
                onClick={() => navigate('/reports')}
                fullWidth
              >
                View Reports
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
