import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

interface TeamMemberHours {
  user_email: string;
  total_hours: number;
  entry_count: number;
}

interface UpcomingDeadline {
  id: number;
  user_email: string;
  hours: number;
  description: string;
  date: string;
  client_name: string;
}

interface ActiveClient {
  id: number;
  name: string;
  department: string | null;
  entry_count: number;
  total_hours: number;
}

interface TeamDashboardData {
  topHoursThisWeek: TeamMemberHours[];
  upcomingDeadlines: UpcomingDeadline[];
  mostActiveClients: ActiveClient[];
}

const TeamDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery<TeamDashboardData>({
    queryKey: ['teamDashboard'],
    queryFn: () => apiClient.getTeamDashboard(),
  });

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Team Workload Dashboard
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Team Workload Dashboard
        </Typography>
        <Typography color="error">Failed to load team dashboard data.</Typography>
      </Box>
    );
  }

  const topHours = data?.topHoursThisWeek || [];
  const deadlines = data?.upcomingDeadlines || [];
  const activeClients = data?.mostActiveClients || [];

  const maxHours = topHours.length > 0 ? topHours[0].total_hours : 1;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Team Workload Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Box sx={{ backgroundColor: '#1976d2', borderRadius: 1, p: 1, color: 'white' }}>
                  <PeopleIcon />
                </Box>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Active Team Members
                  </Typography>
                  <Typography variant="h5">{topHours.length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Box sx={{ backgroundColor: '#388e3c', borderRadius: 1, p: 1, color: 'white' }}>
                  <ScheduleIcon />
                </Box>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Upcoming Entries
                  </Typography>
                  <Typography variant="h5">{deadlines.length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Box sx={{ backgroundColor: '#f57c00', borderRadius: 1, p: 1, color: 'white' }}>
                  <BusinessIcon />
                </Box>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Active Clients
                  </Typography>
                  <Typography variant="h5">{activeClients.length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Hours This Week
            </Typography>
            {topHours.length > 0 ? (
              <Box>
                {topHours.map((member) => (
                  <Box key={member.user_email} sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>
                        {member.user_email}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {member.total_hours.toFixed(1)}h ({member.entry_count} entries)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(member.total_hours / maxHours) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">No hours logged this week.</Typography>
            )}
          </Paper>
        </Grid>

        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Most Active Clients
            </Typography>
            {activeClients.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Client</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">Entries</TableCell>
                      <TableCell align="right">Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.name}</TableCell>
                        <TableCell>
                          {client.department ? (
                            <Chip label={client.department} size="small" variant="outlined" />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="right">{client.entry_count}</TableCell>
                        <TableCell align="right">{client.total_hours.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No active clients found.</Typography>
            )}
          </Paper>
        </Grid>

        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Deadlines
            </Typography>
            {deadlines.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Team Member</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deadlines.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.user_email}</TableCell>
                        <TableCell>{entry.client_name}</TableCell>
                        <TableCell>{entry.description || '—'}</TableCell>
                        <TableCell align="right">{entry.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No upcoming deadlines.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TeamDashboardPage;
