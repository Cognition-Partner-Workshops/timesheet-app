import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import {
  type WeeklyUsageResponse,
  type FeatureTrendsResponse,
  type FeatureBreakdownResponse,
  type FeatureTrend,
  type WeeklyUsageEntry,
} from '../types/api';

const FAMILY_LABELS: Record<string, string> = {
  authentication: 'Authentication',
  client_management: 'Client Management',
  time_tracking: 'Time Tracking',
  reporting: 'Reporting',
};

const FAMILY_COLORS: Record<string, string> = {
  authentication: '#1976d2',
  client_management: '#388e3c',
  time_tracking: '#f57c00',
  reporting: '#7b1fa2',
};

function TractionChip({ traction, percentChange }: { traction: string; percentChange: number }) {
  if (traction === 'gaining') {
    return (
      <Chip
        icon={<TrendingUpIcon />}
        label={`+${percentChange}%`}
        color="success"
        size="small"
        variant="outlined"
      />
    );
  }
  if (traction === 'losing') {
    return (
      <Chip
        icon={<TrendingDownIcon />}
        label={`${percentChange}%`}
        color="error"
        size="small"
        variant="outlined"
      />
    );
  }
  return (
    <Chip
      icon={<TrendingFlatIcon />}
      label={`${percentChange > 0 ? '+' : ''}${percentChange}%`}
      size="small"
      variant="outlined"
    />
  );
}

function WeeklyChart({ weeklyUsage }: { weeklyUsage: Record<string, WeeklyUsageEntry[]> }) {
  const allWeeks = new Set<string>();
  for (const entries of Object.values(weeklyUsage)) {
    for (const entry of entries) {
      allWeeks.add(entry.weekStart);
    }
  }
  const weeks = Array.from(allWeeks).sort();

  if (weeks.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">
          No usage data recorded yet. Start using the app to see weekly trends here.
        </Typography>
      </Box>
    );
  }

  let maxCount = 0;
  for (const entries of Object.values(weeklyUsage)) {
    for (const entry of entries) {
      if (entry.usageCount > maxCount) maxCount = entry.usageCount;
    }
  }
  if (maxCount === 0) maxCount = 1;

  const families = Object.keys(weeklyUsage);

  return (
    <Box>
      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        {families.map((family) => (
          <Chip
            key={family}
            label={FAMILY_LABELS[family] || family}
            size="small"
            sx={{
              backgroundColor: FAMILY_COLORS[family] || '#757575',
              color: 'white',
            }}
          />
        ))}
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Feature Family</TableCell>
              {weeks.map((week) => (
                <TableCell key={week} align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {new Date(week + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {families.map((family) => {
              const usageByWeek: Record<string, WeeklyUsageEntry> = {};
              for (const entry of weeklyUsage[family]) {
                usageByWeek[entry.weekStart] = entry;
              }

              return (
                <TableRow key={family}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: FAMILY_COLORS[family] || '#757575',
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2">{FAMILY_LABELS[family] || family}</Typography>
                    </Box>
                  </TableCell>
                  {weeks.map((week) => {
                    const entry = usageByWeek[week];
                    const count = entry ? entry.usageCount : 0;
                    const pct = (count / maxCount) * 100;

                    return (
                      <TableCell key={week} align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {count}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              mt: 0.5,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: FAMILY_COLORS[family] || '#757575',
                                borderRadius: 3,
                              },
                            }}
                          />
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

const FeatureUsagePage: React.FC = () => {
  const {
    data: weeklyData,
    isLoading: weeklyLoading,
    error: weeklyError,
  } = useQuery<WeeklyUsageResponse>({
    queryKey: ['featureUsageWeekly'],
    queryFn: () => apiClient.getWeeklyFeatureUsage(),
  });

  const {
    data: trendsData,
    isLoading: trendsLoading,
    error: trendsError,
  } = useQuery<FeatureTrendsResponse>({
    queryKey: ['featureUsageTrends'],
    queryFn: () => apiClient.getFeatureUsageTrends(),
  });

  const {
    data: breakdownData,
    isLoading: breakdownLoading,
    error: breakdownError,
  } = useQuery<FeatureBreakdownResponse>({
    queryKey: ['featureUsageBreakdown'],
    queryFn: () => apiClient.getFeatureUsageBreakdown(),
  });

  const isLoading = weeklyLoading || trendsLoading || breakdownLoading;
  const hasError = weeklyError || trendsError || breakdownError;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const trends = trendsData?.trends || [];
  const weeklyUsage = weeklyData?.weeklyUsage || {};
  const breakdown = breakdownData?.breakdown || {};
  const hasTrends = trends.length > 0;
  const hasWeeklyData = Object.keys(weeklyUsage).length > 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Feature Usage Analytics
      </Typography>

      {hasError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load analytics data. Please try again later.
        </Alert>
      )}

      {/* Trend Summary Cards */}
      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        This Week vs. Last Week
      </Typography>
      {hasTrends ? (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {trends.map((trend: FeatureTrend) => (
            // @ts-expect-error - MUI Grid item prop type issue
            <Grid item xs={12} sm={6} md={3} key={trend.featureFamily}>
              <Card
                sx={{
                  borderLeft: `4px solid ${FAMILY_COLORS[trend.featureFamily] || '#757575'}`,
                }}
              >
                <CardContent>
                  <Typography color="textSecondary" variant="body2" gutterBottom>
                    {FAMILY_LABELS[trend.featureFamily] || trend.featureFamily}
                  </Typography>
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="h4" component="div">
                      {trend.currentWeekCount}
                    </Typography>
                    <TractionChip traction={trend.traction} percentChange={trend.percentChange} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Previous week: {trend.previousWeekCount} | Users: {trend.currentUsers}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 3, mb: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No trend data available yet. Use the app features to start generating analytics.
          </Typography>
        </Paper>
      )}

      {/* Weekly Usage Chart */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Weekly Usage Trends (Last 8 Weeks)
        </Typography>
        {hasWeeklyData ? (
          <WeeklyChart weeklyUsage={weeklyUsage} />
        ) : (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">
              No weekly data recorded yet. Start using the app to see trends here.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Action Breakdown */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          This Week&apos;s Action Breakdown
        </Typography>
        {Object.keys(breakdown).length > 0 ? (
          <Grid container spacing={3}>
            {Object.entries(breakdown).map(([family, actions]) => (
              // @ts-expect-error - MUI Grid item prop type issue
              <Grid item xs={12} md={6} key={family}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: FAMILY_COLORS[family] || '#757575',
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="subtitle1" fontWeight="bold">
                        {FAMILY_LABELS[family] || family}
                      </Typography>
                    </Box>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Action</TableCell>
                          <TableCell align="right">Count</TableCell>
                          <TableCell align="right">Users</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {actions.map((action) => (
                          <TableRow key={action.action}>
                            <TableCell>
                              <Chip
                                label={action.action.replace(/_/g, ' ')}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">{action.totalCount}</TableCell>
                            <TableCell align="right">{action.uniqueUsers}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">
              No action data for this week yet.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default FeatureUsagePage;
