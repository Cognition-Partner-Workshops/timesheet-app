import React, { useState, useMemo } from 'react';
import { Box, Typography, IconButton, Button, CircularProgress, Paper } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, format, addWeeks, subWeeks, isThisWeek } from 'date-fns';
import apiClient from '../api/client';

const COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklySummaryChart: React.FC = () => {
  const [weekStartDate, setWeekStartDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['weeklySummary', weekStartStr],
    queryFn: () => apiClient.getWeeklySummary(weekStartStr),
  });

  const chartData = useMemo(() => {
    if (!data?.summary) return [];
    return data.summary.map((day: Record<string, unknown>, index: number) => ({
      ...day,
      label: DAY_LABELS[index],
    }));
  }, [data]);

  const clientNames: string[] = data?.clientNames || [];

  const goToPrevWeek = () => setWeekStartDate((d) => subWeeks(d, 1));
  const goToNextWeek = () => setWeekStartDate((d) => addWeeks(d, 1));
  const goToThisWeek = () => setWeekStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekEndDate = addWeeks(weekStartDate, 1);
  const weekLabel = `${format(weekStartDate, 'MMM d')} – ${format(new Date(weekEndDate.getTime() - 86400000), 'MMM d, yyyy')}`;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6">Weekly Summary</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={goToPrevWeek} size="small">
            <ArrowBack />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 160, textAlign: 'center' }}>
            {weekLabel}
          </Typography>
          <IconButton onClick={goToNextWeek} size="small">
            <ArrowForward />
          </IconButton>
          {!isThisWeek(weekStartDate, { weekStartsOn: 1 }) && (
            <Button size="small" variant="outlined" onClick={goToThisWeek}>
              This Week
            </Button>
          )}
        </Box>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={300}>
          <CircularProgress />
        </Box>
      ) : clientNames.length === 0 ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={300}>
          <Typography color="text.secondary">No work entries for this week</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="label" />
            <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {clientNames.map((name, index) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="hours"
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default WeeklySummaryChart;
