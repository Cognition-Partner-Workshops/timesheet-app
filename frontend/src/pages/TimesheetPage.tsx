import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  addDays,
} from 'date-fns';
import apiClient from '../api/client';
import { type WeeklyTimesheetResponse } from '../types/api';

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

const TimesheetPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
  const weekEndDate = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekEndStr = format(weekEndDate, 'yyyy-MM-dd');

  const dayColumns = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(currentWeekStart, i);
      return {
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'EEE'),
        shortDate: format(day, 'MM/dd'),
      };
    });
  }, [currentWeekStart]);

  const { data, isLoading } = useQuery({
    queryKey: ['weeklyTimesheet', weekStartStr],
    queryFn: () => apiClient.getWeeklyTimesheet(weekStartStr),
  });

  const timesheetData = data as WeeklyTimesheetResponse | undefined;

  const submitMutation = useMutation({
    mutationFn: (params: { weekStart: string; weekEnd: string; totalHours: number }) =>
      apiClient.submitTimesheet(params),
    onSuccess: () => {
      setSuccessMessage('Timesheet submitted successfully!');
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['weeklyTimesheet', weekStartStr] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMessage(error.response?.data?.error || 'Failed to submit timesheet');
      setSuccessMessage('');
    },
  });

  const { clientRows, dayTotals, grandTotal } = useMemo(() => {
    const clients = timesheetData?.clients || [];
    const totals: Record<string, number> = {};

    const rows = clients.map((client) => {
      let rowTotal = 0;
      const cells: Record<string, number> = {};
      for (const col of dayColumns) {
        const hours = client.days[col.date] || 0;
        cells[col.date] = hours;
        rowTotal += hours;
        totals[col.date] = (totals[col.date] || 0) + hours;
      }
      return { ...client, cells, rowTotal };
    });

    const total = rows.reduce((sum, row) => sum + row.rowTotal, 0);

    return { clientRows: rows, dayTotals: totals, grandTotal: total };
  }, [timesheetData, dayColumns]);

  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleThisWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      totalHours: grandTotal,
    });
  };

  const isSubmitted = !!timesheetData?.submission;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Timesheet
      </Typography>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton onClick={handlePrevWeek} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6">
              {format(currentWeekStart, 'MMM d')} – {format(weekEndDate, 'MMM d, yyyy')}
            </Typography>
            <IconButton onClick={handleNextWeek} size="small">
              <ChevronRightIcon />
            </IconButton>
            <Button variant="outlined" size="small" onClick={handleThisWeek} sx={{ ml: 1 }}>
              This Week
            </Button>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            {isSubmitted && (
              <Chip
                label={`Submitted (${timesheetData?.submission?.total_hours}h)`}
                color="success"
                size="small"
              />
            )}
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitted || submitMutation.isPending || grandTotal === 0}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Timesheet'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>Client</TableCell>
                {dayColumns.map((col) => (
                  <TableCell key={col.date} align="center" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                    {col.label}
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {col.shortDate}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                  Total
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No work entries for this week. Add entries on the Work Entries page.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {clientRows.map((row) => (
                    <TableRow key={row.clientId}>
                      <TableCell>{row.clientName}</TableCell>
                      {dayColumns.map((col) => (
                        <TableCell key={col.date} align="center">
                          {row.cells[col.date] ? row.cells[col.date].toFixed(1) : '–'}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                        {row.rowTotal.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Daily Total</TableCell>
                    {dayColumns.map((col) => (
                      <TableCell key={col.date} align="center" sx={{ fontWeight: 'bold' }}>
                        {(dayTotals[col.date] || 0).toFixed(1)}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      {grandTotal.toFixed(1)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TimesheetPage;
