import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  useTheme,
  alpha,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RetryIcon,
  ArrowForward as ArrowIcon,
  Schedule as ScheduleIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { transferJobs as initialJobs, dataSources } from '../data/mockData';
import type { TransferJob } from '../data/mockData';

const statusConfig: Record<string, { color: string; icon: React.ReactElement }> = {
  completed: { color: '#2E7D32', icon: <SuccessIcon sx={{ fontSize: 20 }} /> },
  running: { color: '#1565C0', icon: <PlayIcon sx={{ fontSize: 20 }} /> },
  failed: { color: '#D32F2F', icon: <ErrorIcon sx={{ fontSize: 20 }} /> },
  scheduled: { color: '#ED6C02', icon: <ScheduleIcon sx={{ fontSize: 20 }} /> },
  paused: { color: '#9E9E9E', icon: <PauseIcon sx={{ fontSize: 20 }} /> },
};

const transferSteps = ['Select Source', 'Select Destination', 'Configure Mapping', 'Set Validation Rules', 'Review & Execute'];

const DataTransfer: React.FC = () => {
  const theme = useTheme();
  const [jobs, setJobs] = useState<TransferJob[]>(initialJobs);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({
    name: '',
    source: '',
    destination: '',
    batchSize: '10000',
    parallelism: '4',
    enableValidation: true,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.status === 'running' && job.progress < 100) {
            const increment = Math.random() * 3;
            const newProgress = Math.min(job.progress + increment, 100);
            const newRecords = Math.round((newProgress / 100) * job.totalRecords);
            return {
              ...job,
              progress: newProgress,
              recordsTransferred: newRecords,
              status: newProgress >= 100 ? 'completed' as const : 'running' as const,
            };
          }
          return job;
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (jobId: string, action: 'pause' | 'resume' | 'retry' | 'stop') => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        switch (action) {
          case 'pause': return { ...job, status: 'paused' as const };
          case 'resume': return { ...job, status: 'running' as const };
          case 'retry': return { ...job, status: 'running' as const, progress: 0, recordsTransferred: 0, errorCount: 0 };
          case 'stop': return { ...job, status: 'failed' as const };
          default: return job;
        }
      })
    );
  };

  const handleCreateJob = () => {
    const job: TransferJob = {
      id: `tj-${String(jobs.length + 1).padStart(3, '0')}`,
      name: newJob.name || 'New Transfer Job',
      source: newJob.source,
      destination: newJob.destination,
      status: 'scheduled',
      progress: 0,
      recordsTransferred: 0,
      totalRecords: Math.floor(Math.random() * 500000) + 50000,
      startTime: new Date().toISOString(),
      errorCount: 0,
      validationStatus: 'pending',
    };
    setJobs([job, ...jobs]);
    setDialogOpen(false);
    setActiveStep(0);
    setNewJob({ name: '', source: '', destination: '', batchSize: '10000', parallelism: '4', enableValidation: true });
  };

  const runningJobs = jobs.filter((j) => j.status === 'running');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Data Transfer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Copy and move data between enterprise sources with full pipeline management
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} size="large">
          New Transfer Job
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Running', count: runningJobs.length, color: '#1565C0' },
          { label: 'Completed', count: completedJobs.length, color: '#2E7D32' },
          { label: 'Failed', count: failedJobs.length, color: '#D32F2F' },
          { label: 'Scheduled', count: jobs.filter((j) => j.status === 'scheduled').length, color: '#ED6C02' },
        ].map((stat) => (
          <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>
                  {stat.count}
                </Typography>
                <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {failedJobs.length > 0 && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {failedJobs.length} transfer job(s) have failed. Review errors and retry or contact support.
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Job Name</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Pipeline</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Status</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Progress</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Records</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Errors</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Validation</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Actions</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => {
                  const status = statusConfig[job.status];
                  const isExpanded = expandedJob === job.id;
                  return (
                    <React.Fragment key={job.id}>
                      <TableRow
                        sx={{
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                      >
                        <TableCell>
                          <IconButton size="small">
                            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{job.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{job.id}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 80 }}>{job.source}</Typography>
                            <ArrowIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: 80 }}>{job.destination}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={status.icon}
                            label={job.status}
                            size="small"
                            sx={{
                              bgcolor: alpha(status.color, 0.12),
                              color: status.color,
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={job.progress}
                              sx={{
                                flex: 1,
                                height: 8,
                                borderRadius: 4,
                                bgcolor: alpha(status.color, 0.12),
                                '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: status.color },
                              }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {Math.round(job.progress)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {job.recordsTransferred.toLocaleString()} / {job.totalRecords.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={job.errorCount}
                            size="small"
                            color={job.errorCount > 0 ? 'error' : 'default'}
                            variant={job.errorCount > 0 ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={job.validationStatus.replace('_', ' ')}
                            size="small"
                            color={
                              job.validationStatus === 'passed' ? 'success' :
                              job.validationStatus === 'failed' ? 'error' :
                              job.validationStatus === 'in_progress' ? 'info' : 'default'
                            }
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                            {job.status === 'running' && (
                              <Tooltip title="Pause">
                                <IconButton size="small" onClick={() => handleAction(job.id, 'pause')}>
                                  <PauseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {job.status === 'paused' && (
                              <Tooltip title="Resume">
                                <IconButton size="small" color="primary" onClick={() => handleAction(job.id, 'resume')}>
                                  <PlayIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {job.status === 'failed' && (
                              <Tooltip title="Retry">
                                <IconButton size="small" color="warning" onClick={() => handleAction(job.id, 'retry')}>
                                  <RetryIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {(job.status === 'running' || job.status === 'paused') && (
                              <Tooltip title="Stop">
                                <IconButton size="small" color="error" onClick={() => handleAction(job.id, 'stop')}>
                                  <StopIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={9} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                          <Collapse in={isExpanded}>
                            <Box sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                              <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Job Details</Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="caption" color="text.secondary">Start Time</Typography>
                                      <Typography variant="caption">{new Date(job.startTime).toLocaleString()}</Typography>
                                    </Box>
                                    {job.endTime && (
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption" color="text.secondary">End Time</Typography>
                                        <Typography variant="caption">{new Date(job.endTime).toLocaleString()}</Typography>
                                      </Box>
                                    )}
                                    {job.duration && (
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption" color="text.secondary">Duration</Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{job.duration}</Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Transfer Metrics</Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="caption" color="text.secondary">Throughput</Typography>
                                      <Typography variant="caption">{job.status === 'running' ? '~12,500 rec/s' : 'N/A'}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="caption" color="text.secondary">Batch Size</Typography>
                                      <Typography variant="caption">10,000</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="caption" color="text.secondary">Parallelism</Typography>
                                      <Typography variant="caption">4 threads</Typography>
                                    </Box>
                                  </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Error Summary</Typography>
                                  {job.errorCount > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                      <Typography variant="caption" color="error.main">
                                        {job.errorCount} errors detected during transfer
                                      </Typography>
                                      <Button size="small" variant="outlined" color="error">
                                        View Error Log
                                      </Button>
                                    </Box>
                                  ) : (
                                    <Typography variant="caption" color="success.main">No errors</Typography>
                                  )}
                                </Grid>
                              </Grid>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Transfer Job</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ my: 3 }}>
            {transferSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mt: 3 }}>
            {activeStep === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Job Name"
                  fullWidth
                  value={newJob.name}
                  onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                  placeholder="e.g., Daily Customer Sync"
                />
                <TextField
                  label="Source"
                  select
                  fullWidth
                  value={newJob.source}
                  onChange={(e) => setNewJob({ ...newJob, source: e.target.value })}
                >
                  {dataSources.filter((s) => s.status === 'connected').map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name} ({s.type})
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
            {activeStep === 1 && (
              <TextField
                label="Destination"
                select
                fullWidth
                value={newJob.destination}
                onChange={(e) => setNewJob({ ...newJob, destination: e.target.value })}
              >
                {dataSources.filter((s) => s.status === 'connected' && s.name !== newJob.source).map((s) => (
                  <MenuItem key={s.id} value={s.name}>
                    {s.name} ({s.type})
                  </MenuItem>
                ))}
              </TextField>
            )}
            {activeStep === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info">Auto-mapping enabled. Column names and types will be matched automatically.</Alert>
                <TextField label="Batch Size" fullWidth value={newJob.batchSize} onChange={(e) => setNewJob({ ...newJob, batchSize: e.target.value })} />
                <TextField label="Parallelism (threads)" fullWidth value={newJob.parallelism} onChange={(e) => setNewJob({ ...newJob, parallelism: e.target.value })} />
              </Box>
            )}
            {activeStep === 3 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info">Default validation rules will be applied. You can customize after job creation.</Alert>
                <Typography variant="body2">The following validations will run:</Typography>
                {['Schema Validation', 'Data Type Checks', 'Null Constraint Checks', 'Checksum Verification'].map((rule) => (
                  <Chip key={rule} label={rule} color="primary" variant="outlined" />
                ))}
              </Box>
            )}
            {activeStep === 4 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="success">Ready to execute transfer job</Alert>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2 }}>
                  <Typography variant="body2"><strong>Job:</strong> {newJob.name || 'Untitled'}</Typography>
                  <Typography variant="body2"><strong>Source:</strong> {newJob.source}</Typography>
                  <Typography variant="body2"><strong>Destination:</strong> {newJob.destination}</Typography>
                  <Typography variant="body2"><strong>Batch Size:</strong> {newJob.batchSize}</Typography>
                  <Typography variant="body2"><strong>Parallelism:</strong> {newJob.parallelism} threads</Typography>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep(activeStep - 1)}>Back</Button>}
          {activeStep < transferSteps.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep(activeStep + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="contained" color="success" onClick={handleCreateJob}>
              Execute Transfer
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataTransfer;
