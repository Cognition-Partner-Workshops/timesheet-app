import React from 'react';
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
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type TeamWorkloadData } from '../types/api';

const TeamWorkloadPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['teamWorkload'],
    queryFn: () => apiClient.getTeamWorkload(),
  });

  const workloadData = data as TeamWorkloadData | undefined;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const teamHours = workloadData?.teamHoursThisWeek || [];
  const upcomingDeadlines = workloadData?.upcomingDeadlines || [];
  const activeClients = workloadData?.activeClients || [];
  const weekRange = workloadData?.weekRange;

  const maxHours = teamHours.length > 0 ? Math.max(...teamHours.map((m) => m.total_hours)) : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Team Workload Dashboard
      </Typography>
      {weekRange && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Week of {new Date(weekRange.start).toLocaleDateString()} &ndash;{' '}
          {new Date(weekRange.end).toLocaleDateString()}
        </Typography>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupIcon color="primary" />
                <Typography color="textSecondary">Team Members Active</Typography>
              </Box>
              <Typography variant="h4">{teamHours.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ScheduleIcon color="warning" />
                <Typography color="textSecondary">Upcoming Entries</Typography>
              </Box>
              <Typography variant="h4">{upcomingDeadlines.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <BusinessIcon color="success" />
                <Typography color="textSecondary">Active Clients</Typography>
              </Box>
              <Typography variant="h4">{activeClients.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Hours Logged This Week
            </Typography>
            {teamHours.length > 0 ? (
              <Box>
                {teamHours.map((member) => (
                  <Box key={member.user_email} sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2">{member.user_email}</Typography>
                      <Chip
                        label={`${member.total_hours.toFixed(1)}h`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={maxHours > 0 ? (member.total_hours / maxHours) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {member.entry_count} {member.entry_count === 1 ? 'entry' : 'entries'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">No hours logged this week yet.</Typography>
            )}
          </Paper>
        </Grid>

        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Clients with Most Active Work
            </Typography>
            {activeClients.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Client</TableCell>
                      <TableCell align="right">Entries</TableCell>
                      <TableCell align="right">Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.name}</TableCell>
                        <TableCell align="right">
                          <Chip label={client.entry_count} size="small" />
                        </TableCell>
                        <TableCell align="right">{client.total_hours.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No active clients in the last 30 days.</Typography>
            )}
          </Paper>
        </Grid>

        {/* @ts-expect-error - MUI Grid item prop type issue */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Deadlines
            </Typography>
            {upcomingDeadlines.length > 0 ? (
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
                    {upcomingDeadlines.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(entry.date).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>{entry.user_email}</TableCell>
                        <TableCell>{entry.client_name}</TableCell>
                        <TableCell>
                          {entry.description || (
                            <Typography variant="body2" color="text.secondary">
                              No description
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${entry.hours}h`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
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

export default TeamWorkloadPage;
