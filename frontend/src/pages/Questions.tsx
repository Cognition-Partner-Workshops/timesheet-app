import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Tooltip, InputAdornment, Tab, Tabs, Accordion, AccordionSummary,
  AccordionDetails, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, Code as CodeIcon,
  Timer as TimerIcon, Category as CategoryIcon,
} from '@mui/icons-material';
import { getQuestions, createQuestion, deleteQuestion } from '../services/api';

interface Question {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  tags: string;
  sample_input: string;
  sample_output: string;
  time_limit_minutes: number;
  created_at: string;
}

const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [form, setForm] = useState({
    title: '', description: '', difficulty: 'medium', category: '',
    tags: '', sample_input: '', sample_output: '', time_limit_minutes: 30,
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await getQuestions();
      setQuestions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createQuestion(form);
      setDialogOpen(false);
      setForm({
        title: '', description: '', difficulty: 'medium', category: '',
        tags: '', sample_input: '', sample_output: '', time_limit_minutes: 30,
      });
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this question?')) {
      await deleteQuestion(id);
      fetchQuestions();
    }
  };

  const getDifficultyConfig = (diff: string) => {
    switch (diff) {
      case 'easy': return { color: '#10b981', bg: '#ecfdf5', label: 'Easy' };
      case 'medium': return { color: '#f59e0b', bg: '#fef3c7', label: 'Medium' };
      case 'hard': return { color: '#ef4444', bg: '#fef2f2', label: 'Hard' };
      default: return { color: '#64748b', bg: '#f1f5f9', label: diff };
    }
  };

  const categories = ['all', ...Array.from(new Set(questions.map(q => q.category)))];

  const filteredQuestions = questions.filter(q => {
    const matchesDifficulty = activeTab === 0 ||
      (activeTab === 1 && q.difficulty === 'easy') ||
      (activeTab === 2 && q.difficulty === 'medium') ||
      (activeTab === 3 && q.difficulty === 'hard');
    const matchesCategory = selectedCategory === 'all' || q.category === selectedCategory;
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDifficulty && matchesCategory && matchesSearch;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Question Bank
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage your technical interview questions library
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add Question
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['easy', 'medium', 'hard'].map((diff) => {
          const config = getDifficultyConfig(diff);
          const count = questions.filter(q => q.difficulty === diff).length;
          return (
            <Grid size={{ xs: 4 }} key={diff}>
              <Card sx={{ bgcolor: config.bg, border: 'none', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: config.color }}>
                    {count}
                  </Typography>
                  <Typography variant="body2" sx={{ color: config.color, fontWeight: 600 }}>
                    {config.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search questions..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{ '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}
            >
              <Tab label="All" />
              <Tab label="Easy" />
              <Tab label="Medium" />
              <Tab label="Hard" />
            </Tabs>
            <TextField
              select size="small" value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              {categories.map(c => (
                <MenuItem key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {/* Question List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredQuestions.map((question) => {
          const diffConfig = getDifficultyConfig(question.difficulty);
          return (
            <Accordion
              key={question.id}
              sx={{
                borderRadius: '16px !important',
                '&:before': { display: 'none' },
                border: '1px solid', borderColor: 'divider',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, '& .MuiAccordionSummary-content': { my: 2 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, pr: 2 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2,
                    bgcolor: diffConfig.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CodeIcon sx={{ color: diffConfig.color, fontSize: 20 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {question.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                      <Chip
                        label={diffConfig.label} size="small"
                        sx={{ bgcolor: diffConfig.bg, color: diffConfig.color, fontWeight: 600, height: 22, fontSize: '0.7rem' }}
                      />
                      <Chip
                        icon={<CategoryIcon sx={{ fontSize: '14px !important' }} />}
                        label={question.category} size="small"
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 1 }}>
                        <TimerIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {question.time_limit_minutes} min
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleDelete(question.id); }}
                      sx={{ color: '#ef4444' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {question.description}
                </Typography>
                {question.sample_input && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      SAMPLE INPUT
                    </Typography>
                    <Box sx={{
                      p: 1.5, bgcolor: '#f8fafc', borderRadius: 2,
                      fontFamily: 'monospace', fontSize: '0.85rem',
                      border: '1px solid #e2e8f0',
                    }}>
                      {question.sample_input}
                    </Box>
                  </Box>
                )}
                {question.sample_output && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      EXPECTED OUTPUT
                    </Typography>
                    <Box sx={{
                      p: 1.5, bgcolor: '#f8fafc', borderRadius: 2,
                      fontFamily: 'monospace', fontSize: '0.85rem',
                      border: '1px solid #e2e8f0',
                    }}>
                      {question.sample_output}
                    </Box>
                  </Box>
                )}
                {question.tags && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {question.tags.split(',').map((tag) => (
                      <Chip
                        key={tag} label={tag.trim()} size="small" variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 24, borderRadius: 1.5 }}
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Question</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid>
              <TextField fullWidth label="Title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Grid>
            <Grid>
              <TextField fullWidth label="Description" multiline rows={4} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid>
              <TextField select fullWidth label="Difficulty" value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </TextField>
            </Grid>
            <Grid>
              <TextField fullWidth label="Category" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Grid>
            <Grid>
              <TextField fullWidth label="Tags (comma-separated)" value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Grid>
            <Grid>
              <TextField fullWidth label="Sample Input" multiline rows={2} value={form.sample_input}
                onChange={(e) => setForm({ ...form, sample_input: e.target.value })} />
            </Grid>
            <Grid>
              <TextField fullWidth label="Expected Output" multiline rows={2} value={form.sample_output}
                onChange={(e) => setForm({ ...form, sample_output: e.target.value })} />
            </Grid>
            <Grid>
              <TextField fullWidth label="Time Limit (minutes)" type="number" value={form.time_limit_minutes}
                onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.title || !form.description || !form.category}>
            Create Question
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Questions;
