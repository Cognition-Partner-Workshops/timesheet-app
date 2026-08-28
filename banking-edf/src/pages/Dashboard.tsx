import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Chip, LinearProgress, useTheme, alpha } from '@mui/material';
import {
  Storage as StorageIcon,
  SwapHoriz as TransferIcon,
  CheckCircle as ValidationIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import StatCard from '../components/StatCard';
import { dashboardStats, transferTrend, sourceTypeDistribution, transferJobs } from '../data/mockData';

const statusColors: Record<string, string> = {
  completed: '#2E7D32',
  running: '#1565C0',
  failed: '#D32F2F',
  scheduled: '#ED6C02',
  paused: '#9E9E9E',
};

const Dashboard: React.FC = () => {
  const theme = useTheme();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Data Pipeline Overview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time monitoring of your Enterprise Data Framework operations
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Connected Sources"
            value={`${dashboardStats.connectedSources}/${dashboardStats.totalSources}`}
            icon={<StorageIcon />}
            color={theme.palette.primary.main}
            trend={12}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Active Pipelines"
            value={dashboardStats.activePipelines}
            icon={<TransferIcon />}
            color={theme.palette.secondary.main}
            trend={5}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Validation Rate"
            value={`${dashboardStats.overallValidationRate}%`}
            icon={<ValidationIcon />}
            color="#2E7D32"
            trend={0.3}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Records Moved Today"
            value={`${(dashboardStats.totalRecordsMoved / 1000000).toFixed(1)}M`}
            icon={<SpeedIcon />}
            color="#ED6C02"
            trend={-2}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Transfer Volume (7 Days)
              </Typography>
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transferTrend}>
                    <defs>
                      <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                    <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                    <YAxis
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                      tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="records"
                      stroke={theme.palette.primary.main}
                      fill="url(#colorRecords)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Source Type Distribution
              </Typography>
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sourceTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Error Trend (7 Days)
              </Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transferTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                    <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                    <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="errors" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">System Health</Typography>
                <Chip label="Healthy" color="success" size="small" />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {[
                  { label: 'CPU Usage', value: 42, color: theme.palette.primary.main },
                  { label: 'Memory Usage', value: 68, color: theme.palette.secondary.main },
                  { label: 'Storage I/O', value: 55, color: theme.palette.warning.main },
                  { label: 'Network', value: 23, color: '#9C27B0' },
                ].map((item) => (
                  <Box key={item.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.value}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={item.value}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: alpha(item.color, 0.12),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: item.color,
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Pipeline Activity
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {transferJobs.slice(0, 5).map((job) => (
              <Box
                key={job.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.default, 0.6),
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: statusColors[job.status],
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {job.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {job.source} → {job.destination}
                  </Typography>
                </Box>
                <Chip
                  label={job.status}
                  size="small"
                  sx={{
                    bgcolor: alpha(statusColors[job.status], 0.12),
                    color: statusColors[job.status],
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                />
                {job.status === 'running' && (
                  <Box sx={{ width: 100 }}>
                    <LinearProgress variant="determinate" value={job.progress} />
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
                  {job.recordsTransferred.toLocaleString()} rec
                </Typography>
                {job.errorCount > 0 && (
                  <Chip
                    icon={<WarningIcon sx={{ fontSize: 14 }} />}
                    label={`${job.errorCount} errors`}
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
