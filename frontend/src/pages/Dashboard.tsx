import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip,
  LinearProgress, IconButton, Tooltip, Paper, Skeleton,
} from '@mui/material';
import {
  Event as EventIcon, People as PeopleIcon,
  QuestionAnswer as QuestionIcon,
  Schedule as ScheduleIcon, CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon, MoreVert as MoreVertIcon,
  ArrowUpward as ArrowUpwardIcon, CalendarMonth as CalendarIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { getDashboardStats, getInterviews } from '../services/api';

interface Stats {
  total_interviews: number;
  upcoming_interviews: number;
  completed_interviews: number;
  total_candidates: number;
  total_questions: number;
  average_score: number | null;
}

interface Interview {
  id: number;
  title: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  interviewer?: { full_name: string };
  candidate?: { full_name: string };
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  change?: string;
}> = ({ title, value, icon, color, gradient, change }) => (
  <Card sx={{
    position: 'relative', overflow: 'hidden',
    '&:hover': { transform: 'translateY(-2px)' },
    transition: 'all 0.3s ease',
  }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontWeight: 500 }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
            {value}
          </Typography>
          {change && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ArrowUpwardIcon sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                {change}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                vs last month
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{
          width: 52, height: 52, borderRadius: 3,
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 3, background: gradient,
    }} />
  </Card>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, interviewsRes] = await Promise.all([
          getDashboardStats(),
          getInterviews(),
        ]);
        setStats(statsRes.data);
        setInterviews(interviewsRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return { bg: '#eff6ff', color: '#3b82f6', label: 'Scheduled' };
      case 'in_progress': return { bg: '#fef3c7', color: '#f59e0b', label: 'In Progress' };
      case 'completed': return { bg: '#ecfdf5', color: '#10b981', label: 'Completed' };
      case 'cancelled': return { bg: '#fef2f2', color: '#ef4444', label: 'Cancelled' };
      default: return { bg: '#f1f5f9', color: '#64748b', label: status };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={150} sx={{ borderRadius: 4 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Welcome back! Here's an overview of your interview activities.
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid>
          <StatCard
            title="Total Interviews"
            value={stats?.total_interviews || 0}
            icon={<EventIcon />}
            color="#6366f1"
            gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
            change="+12%"
          />
        </Grid>
        <Grid>
          <StatCard
            title="Upcoming"
            value={stats?.upcoming_interviews || 0}
            icon={<ScheduleIcon />}
            color="#3b82f6"
            gradient="linear-gradient(135deg, #3b82f6, #60a5fa)"
            change="+8%"
          />
        </Grid>
        <Grid>
          <StatCard
            title="Candidates"
            value={stats?.total_candidates || 0}
            icon={<PeopleIcon />}
            color="#10b981"
            gradient="linear-gradient(135deg, #10b981, #34d399)"
            change="+24%"
          />
        </Grid>
        <Grid>
          <StatCard
            title="Avg. Score"
            value={stats?.average_score ? `${stats.average_score}/5` : 'N/A'}
            icon={<StarIcon />}
            color="#f59e0b"
            gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Upcoming Interviews */}
        <Grid>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Recent Interviews
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Your latest interview sessions
                  </Typography>
                </Box>
                <Chip label={`${interviews.length} Total`} size="small" sx={{
                  bgcolor: '#eff6ff', color: '#3b82f6', fontWeight: 600,
                }} />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {interviews.slice(0, 5).map((interview) => {
                  const statusInfo = getStatusColor(interview.status);
                  return (
                    <Paper
                      key={interview.id}
                      elevation={0}
                      sx={{
                        p: 2.5, borderRadius: 3,
                        border: '1px solid', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', gap: 2,
                        '&:hover': {
                          borderColor: '#c7d2fe',
                          bgcolor: '#fafafe',
                        },
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                    >
                      <Box sx={{
                        width: 44, height: 44, borderRadius: 2,
                        bgcolor: statusInfo.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {interview.status === 'completed' ? (
                          <CheckCircleIcon sx={{ color: statusInfo.color }} />
                        ) : interview.status === 'in_progress' ? (
                          <PlayArrowIcon sx={{ color: statusInfo.color }} />
                        ) : (
                          <CalendarIcon sx={{ color: statusInfo.color }} />
                        )}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.3 }} noWrap>
                          {interview.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {interview.candidate?.full_name || 'TBD'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            •
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {interview.duration_minutes} min
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: 'right', mr: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {formatDate(interview.scheduled_at)}
                        </Typography>
                        <Chip
                          label={statusInfo.label}
                          size="small"
                          sx={{
                            mt: 0.5, bgcolor: statusInfo.bg, color: statusInfo.color,
                            fontWeight: 600, fontSize: '0.7rem', height: 22,
                          }}
                        />
                      </Box>

                      <Tooltip title="More options">
                        <IconButton size="small">
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Paper>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Sidebar */}
        <Grid>
          {/* Question Bank Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                Question Bank
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 2,
                  background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}>
                  <QuestionIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {stats?.total_questions || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total Questions
                  </Typography>
                </Box>
              </Box>
              {['Easy', 'Medium', 'Hard'].map((diff, i) => (
                <Box key={diff} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{diff}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {[3, 3, 2][i]} questions
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={[37, 37, 26][i]}
                    sx={{
                      height: 6, borderRadius: 3,
                      bgcolor: '#f1f5f9',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        background: [
                          'linear-gradient(90deg, #10b981, #34d399)',
                          'linear-gradient(90deg, #f59e0b, #fbbf24)',
                          'linear-gradient(90deg, #ef4444, #f87171)',
                        ][i],
                      },
                    }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Activity
              </Typography>
              {[
                { text: 'New interview scheduled with Alex Thompson', time: '2 hours ago', color: '#6366f1' },
                { text: 'Feedback submitted for James Wilson', time: '5 hours ago', color: '#10b981' },
                { text: 'Question bank updated with 2 new questions', time: '1 day ago', color: '#f59e0b' },
                { text: 'Interview completed with Priya Patel', time: '2 days ago', color: '#ec4899' },
              ].map((activity, i) => (
                <Box key={i} sx={{
                  display: 'flex', gap: 2, py: 1.5,
                  borderBottom: i < 3 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}>
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: activity.color, mt: 0.8, flexShrink: 0,
                  }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.3 }}>
                      {activity.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {activity.time}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
