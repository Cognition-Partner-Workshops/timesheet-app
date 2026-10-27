import React, { useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useWeeklySummary } from '../hooks/useWeeklySummary';
import { addWeeks, getWeekStart } from '../utils/week';

function formatHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    ...options,
    timeZone: 'UTC',
  });
}

const WeeklySummaryCard: React.FC = () => {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const { data, isLoading, isError } = useWeeklySummary(weekStart);

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} mb={2}>
        <Box>
          <Typography variant="h5">This week</Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              {formatDate(data.weekStart, { month: 'short', day: 'numeric' })}
              {' – '}
              {formatDate(data.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          )}
        </Box>
        <Box display="flex">
          <IconButton
            aria-label="Previous week"
            onClick={() => setWeekStart((currentWeek) => addWeeks(currentWeek, -1))}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            aria-label="Next week"
            onClick={() => setWeekStart((currentWeek) => addWeeks(currentWeek, 1))}
          >
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress />
        </Box>
      )}
      {isError && (
        <Alert severity="error">Unable to load this week&apos;s summary.</Alert>
      )}
      {data && !isLoading && (
        <Box>
          <Typography variant="h4" component="p" mb={2}>
            {formatHours(data.totalHours)} h
          </Typography>
          {data.overLimit && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Over 40 hours this week ({formatHours(data.totalHours)} h)
            </Alert>
          )}

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
            <Box>
              <Typography variant="h6" mb={1}>By day</Typography>
              {data.days.map((day) => (
                <Box key={day.date} display="flex" justifyContent="space-between" py={0.5}>
                  <Typography variant="body2">
                    {formatDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Typography>
                  <Typography variant="body2">{formatHours(day.hours)} h</Typography>
                </Box>
              ))}
            </Box>
            <Box>
              <Typography variant="h6" mb={1}>By client</Typography>
              {data.clients.length > 0 ? (
                data.clients.map((client) => (
                  <Box key={client.clientId} display="flex" justifyContent="space-between" py={0.5}>
                    <Typography variant="body2">{client.clientName}</Typography>
                    <Typography variant="body2">{formatHours(client.hours)} h</Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No hours logged</Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default WeeklySummaryCard;
