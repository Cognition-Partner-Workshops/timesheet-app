import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Rating,
  LinearProgress, Paper,
} from '@mui/material';
import {
  Star as StarIcon,
  ThumbUp as ThumbUpIcon, ThumbDown as ThumbDownIcon,
  Schedule as ScheduleIcon, Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { getFeedbacks, getInterviews } from '../services/api';

interface FeedbackData {
  id: number;
  interview_id: number;
  reviewer_id: number;
  technical_score: number;
  communication_score: number;
  problem_solving_score: number;
  overall_score: number;
  strengths: string;
  weaknesses: string;
  comments: string;
  recommendation: string;
  created_at: string;
}

const Reports: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fbRes, intRes] = await Promise.all([
          getFeedbacks(),
          getInterviews(),
        ]);
        setFeedbacks(fbRes.data);
        setInterviews(intRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getRecommendationConfig = (rec: string) => {
    switch (rec) {
      case 'hire': return { color: '#10b981', bg: '#ecfdf5', label: 'Hire', icon: <ThumbUpIcon fontSize="small" /> };
      case 'next_round': return { color: '#3b82f6', bg: '#eff6ff', label: 'Next Round', icon: <ScheduleIcon fontSize="small" /> };
      case 'reject': return { color: '#ef4444', bg: '#fef2f2', label: 'Reject', icon: <ThumbDownIcon fontSize="small" /> };
      default: return { color: '#64748b', bg: '#f1f5f9', label: rec || 'Pending', icon: <AssessmentIcon fontSize="small" /> };
    }
  };

  const avgScore = (field: keyof FeedbackData) => {
    const scores = feedbacks.map(f => f[field] as number).filter(s => s != null);
    return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
  };

  const getInterviewTitle = (interviewId: number) => {
    const interview = interviews.find(i => i.id === interviewId);
    return interview?.title || `Interview #${interviewId}`;
  };

  const getCandidateName = (interviewId: number) => {
    const interview = interviews.find(i => i.id === interviewId);
    return interview?.candidate?.full_name || 'Unknown';
  };

  const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color }}>{value}/5.0</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(value / 5) * 100}
        sx={{
          height: 8, borderRadius: 4, bgcolor: '#f1f5f9',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            bgcolor: color,
          },
        }}
      />
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Reports & Analytics
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Interview performance insights and feedback analysis
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Avg. Technical', value: avgScore('technical_score'), color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
          { label: 'Avg. Communication', value: avgScore('communication_score'), color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
          { label: 'Avg. Problem Solving', value: avgScore('problem_solving_score'), color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
          { label: 'Avg. Overall', value: avgScore('overall_score'), color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
        ].map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.label}>
            <Card sx={{ position: 'relative', overflow: 'hidden' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                  {item.label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>/5.0</Typography>
                </Box>
              </CardContent>
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: item.gradient }} />
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Detailed Feedback */}
        <Grid>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                Interview Feedback
              </Typography>

              {feedbacks.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <AssessmentIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                    No feedback recorded yet
                  </Typography>
                </Box>
              )}

              {feedbacks.map((feedback, index) => {
                const recConfig = getRecommendationConfig(feedback.recommendation);
                return (
                  <Paper
                    key={feedback.id}
                    elevation={0}
                    sx={{
                      p: 3, mb: 2, borderRadius: 3,
                      border: '1px solid', borderColor: 'divider',
                      '&:hover': { borderColor: '#c7d2fe' },
                    }}
                  >
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.3 }}>
                          {getInterviewTitle(feedback.interview_id)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Candidate: {getCandidateName(feedback.interview_id)}
                        </Typography>
                      </Box>
                      <Chip
                        icon={recConfig.icon}
                        label={recConfig.label}
                        sx={{
                          bgcolor: recConfig.bg, color: recConfig.color,
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: recConfig.color },
                        }}
                      />
                    </Box>

                    {/* Scores */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid>
                        <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#6366f1' }}>
                            {feedback.technical_score}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Technical</Typography>
                        </Box>
                      </Grid>
                      <Grid>
                        <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                            {feedback.communication_score}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Communication</Typography>
                        </Box>
                      </Grid>
                      <Grid>
                        <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>
                            {feedback.problem_solving_score}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Problem Solving</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Overall */}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      p: 2, bgcolor: '#fef3c7', borderRadius: 2, mb: 2,
                    }}>
                      <StarIcon sx={{ color: '#f59e0b' }} />
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        Overall Score: {feedback.overall_score}/5.0
                      </Typography>
                      <Rating value={feedback.overall_score} precision={0.1} readOnly size="small" sx={{ ml: 'auto' }} />
                    </Box>

                    {/* Strengths & Weaknesses */}
                    {feedback.strengths && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#10b981', display: 'block', mb: 0.5 }}>
                          STRENGTHS
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {feedback.strengths}
                        </Typography>
                      </Box>
                    )}
                    {feedback.weaknesses && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#ef4444', display: 'block', mb: 0.5 }}>
                          AREAS FOR IMPROVEMENT
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {feedback.weaknesses}
                        </Typography>
                      </Box>
                    )}
                    {feedback.comments && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          COMMENTS
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {feedback.comments}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                Score Distribution
              </Typography>
              {feedbacks.length > 0 && (
                <>
                  <ScoreBar label="Technical Skills" value={parseFloat(avgScore('technical_score') as string) || 0} color="#6366f1" />
                  <ScoreBar label="Communication" value={parseFloat(avgScore('communication_score') as string) || 0} color="#3b82f6" />
                  <ScoreBar label="Problem Solving" value={parseFloat(avgScore('problem_solving_score') as string) || 0} color="#10b981" />
                  <ScoreBar label="Overall" value={parseFloat(avgScore('overall_score') as string) || 0} color="#f59e0b" />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                Recommendations
              </Typography>
              {['hire', 'next_round', 'reject'].map((rec) => {
                const config = getRecommendationConfig(rec);
                const count = feedbacks.filter(f => f.recommendation === rec).length;
                return (
                  <Box key={rec} sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    p: 1.5, mb: 1, borderRadius: 2,
                    bgcolor: config.bg,
                  }}>
                    {config.icon}
                    <Typography variant="body2" sx={{ fontWeight: 600, color: config.color, flex: 1 }}>
                      {config.label}
                    </Typography>
                    <Chip label={count} size="small" sx={{ bgcolor: config.color, color: '#fff', fontWeight: 700, minWidth: 32 }} />
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports;
