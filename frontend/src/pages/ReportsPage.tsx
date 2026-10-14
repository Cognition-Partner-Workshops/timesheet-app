import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  CalendarMonth as WeeklyIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type ClientReport, type WeeklyReportWeek } from '../types/api';

const ReportsPage: React.FC = () => {
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['clientReport', selectedClientId],
    queryFn: () => apiClient.getClientReport(selectedClientId),
    enabled: selectedClientId > 0,
  });

  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weeklyReport'],
    queryFn: () => apiClient.getWeeklyReport(),
  });

  const clients = clientsData?.clients || [];
  const report = reportData as ClientReport | undefined;
  const weeks = (weeklyData?.weeks || []) as WeeklyReportWeek[];

  const handleExportCsv = async () => {
    if (!selectedClientId) return;
    
    try {
      const blob = await apiClient.exportClientReportCsv(selectedClientId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const client = clients.find((c: { id: number; name: string }) => c.id === selectedClientId);
      a.download = `${client?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError('Failed to export CSV report');
      console.error('Export error:', err);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedClientId) return;

    try {
      const blob = await apiClient.exportClientReportPdf(selectedClientId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const client = clients.find((c: { id: number; name: string }) => c.id === selectedClientId);
      a.download = `${client?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError('Failed to export PDF report');
      console.error('Export error:', err);
    }
  };

  const handleExportWeeklyCsv = async () => {
    try {
      const blob = await apiClient.exportWeeklyReportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError('Failed to export weekly CSV report');
      console.error('Export error:', err);
    }
  };

  const handleExportWeeklyPdf = async () => {
    try {
      const blob = await apiClient.exportWeeklyReportPdf();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError('Failed to export weekly PDF report');
      console.error('Export error:', err);
    }
  };

  const selectedClient = clients.find((c: { id: number; name: string }) => c.id === selectedClientId);

  if (clientsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Client Report" />
          <Tab icon={<WeeklyIcon />} iconPosition="start" label="Weekly Report" />
        </Tabs>
      </Paper>

      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Weekly Work Entries Report</Typography>
              <Box display="flex" gap={1}>
                <Tooltip title="Export Weekly Report as CSV">
                  <IconButton onClick={handleExportWeeklyCsv} disabled={weeklyLoading || weeks.length === 0} color="primary" size="large">
                    <CsvIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export Weekly Report as PDF">
                  <IconButton onClick={handleExportWeeklyPdf} disabled={weeklyLoading || weeks.length === 0} color="error" size="large">
                    <PdfIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Paper>

          {weeklyLoading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          )}

          {!weeklyLoading && weeks.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No work entries found. Add some work entries to see the weekly report.
              </Typography>
            </Paper>
          )}

          {!weeklyLoading && weeks.map((week: WeeklyReportWeek) => (
            <Paper key={week.weekStartDate} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    Week of {new Date(week.weekStartDate + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                  <Chip label={`${week.totalHours.toFixed(2)} hours`} color="primary" />
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Logged Date</TableCell>
                      <TableCell>Client Name</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Logged By</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {week.entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{new Date(entry.date + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC' })}</TableCell>
                        <TableCell><Chip label={entry.client_name} size="small" variant="outlined" /></TableCell>
                        <TableCell><Chip label={`${entry.hours} hrs`} color="primary" variant="outlined" size="small" /></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{entry.user_email}</Typography></TableCell>
                        <TableCell>
                          {entry.description ? (
                            <Typography variant="body2" color="text.secondary">{entry.description}</Typography>
                          ) : (
                            <Chip label="No description" size="small" variant="outlined" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}
        </Box>
      )}

      {activeTab === 0 && clients.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            You need to create at least one client before generating reports.
          </Typography>
          <Button variant="contained" href="/clients">
            Create Client
          </Button>
        </Paper>
      ) : activeTab === 0 ? (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Select Client</InputLabel>
                  <Select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                    label="Select Client"
                  >
                    <MenuItem value={0}>Choose a client...</MenuItem>
                    {clients.map((c: { id: number; name: string }) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box display="flex" gap={2}>
                  <Tooltip title="Export as CSV">
                    <IconButton
                      onClick={handleExportCsv}
                      disabled={!selectedClientId || reportLoading}
                      color="primary"
                      size="large"
                    >
                      <CsvIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Export as PDF">
                    <IconButton
                      onClick={handleExportPdf}
                      disabled={!selectedClientId || reportLoading}
                      color="error"
                      size="large"
                    >
                      <PdfIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {selectedClient && reportLoading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          )}

          {selectedClient && report && (
            <>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Hours
                      </Typography>
                      <Typography variant="h4" component="div">
                        {report.totalHours.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Entries
                      </Typography>
                      <Typography variant="h4" component="div">
                        {report.entryCount}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Average Hours per Entry
                      </Typography>
                      <Typography variant="h4" component="div">
                        {report.entryCount > 0 ? (report.totalHours / report.entryCount).toFixed(2) : '0.00'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Paper>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Hours</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.workEntries.length > 0 ? (
                        report.workEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(entry.date).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={`${entry.hours} hours`} 
                                color="primary" 
                                variant="outlined" 
                              />
                            </TableCell>
                            <TableCell>
                              {entry.description ? (
                                <Typography variant="body2" color="text.secondary">
                                  {entry.description}
                                </Typography>
                              ) : (
                                <Chip label="No description" size="small" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {new Date(entry.created_at).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography color="text.secondary" sx={{ py: 3 }}>
                              No work entries found for this client.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}

          {!selectedClient && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Select a client to view their time report.
              </Typography>
            </Paper>
          )}
        </>
      ) : null}
    </Box>
  );
};

export default ReportsPage;
