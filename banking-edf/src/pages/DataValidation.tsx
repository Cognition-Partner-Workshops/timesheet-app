import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Switch,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as PassedIcon,
  Error as FailedIcon,
  Security as ComplianceIcon,
  Schema as SchemaIcon,
  DataObject as DataIcon,
  AccountTree as RefIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { validationRules as initialRules } from '../data/mockData';
import type { ValidationRule } from '../data/mockData';


const categoryConfig: Record<string, { icon: React.ReactElement; color: string }> = {
  Schema: { icon: <SchemaIcon />, color: '#1565C0' },
  'Data Quality': { icon: <DataIcon />, color: '#00897B' },
  Business: { icon: <BusinessIcon />, color: '#ED6C02' },
  'Referential Integrity': { icon: <RefIcon />, color: '#9C27B0' },
  Compliance: { icon: <ComplianceIcon />, color: '#D32F2F' },
};

const severityConfig = {
  critical: { color: '#D32F2F', label: 'Critical' },
  warning: { color: '#ED6C02', label: 'Warning' },
  info: { color: '#1565C0', label: 'Info' },
};

const DataValidation: React.FC = () => {
  const theme = useTheme();
  const [rules, setRules] = useState<ValidationRule[]>(initialRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [runningValidation, setRunningValidation] = useState(false);

  const categories = ['all', ...Object.keys(categoryConfig)];
  const filteredRules = selectedCategory === 'all' ? rules : rules.filter((r) => r.category === selectedCategory);

  const overallPassRate = rules.reduce((sum, r) => sum + r.passRate, 0) / rules.length;
  const totalFailedRecords = rules.reduce((sum, r) => sum + r.failedRecords, 0);
  const criticalFailures = rules.filter((r) => r.severity === 'critical' && r.passRate < 100);

  const passRateDistribution = [
    { name: 'Passed', value: Math.round(overallPassRate * 100), color: '#2E7D32' },
    { name: 'Failed', value: Math.round((100 - overallPassRate) * 100), color: '#D32F2F' },
  ];

  const handleToggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleRunAll = () => {
    setRunningValidation(true);
    setTimeout(() => {
      setRules(
        rules.map((r) => ({
          ...r,
          lastRun: new Date().toISOString(),
          passRate: Math.max(r.passRate + (Math.random() - 0.5) * 0.1, 98),
        }))
      );
      setRunningValidation(false);
    }, 3000);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Data Validation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Define and execute validation rules to ensure data quality and compliance
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RunIcon />}
            onClick={handleRunAll}
            disabled={runningValidation}
          >
            {runningValidation ? 'Running...' : 'Run All Rules'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Rule
          </Button>
        </Box>
      </Box>

      {runningValidation && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<RunIcon />}>
          <Typography variant="body2">Validation in progress... Running {rules.filter((r) => r.enabled).length} active rules</Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

      {criticalFailures.length > 0 && !runningValidation && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {criticalFailures.length} critical validation rule(s) have failures. Immediate attention required.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }} color="success.main">
                {overallPassRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">Overall Pass Rate</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>{rules.length}</Typography>
              <Typography variant="body2" color="text.secondary">Total Rules</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 700 }} color="error.main">
                {totalFailedRecords.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">Failed Records</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Box sx={{ width: 100, height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passRateDistribution}
                      innerRadius={30}
                      outerRadius={45}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {passRateDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ ml: 1 }}>
                <Typography variant="body2" color="text.secondary">Pass/Fail</Typography>
                <Typography variant="caption" color="text.secondary">Distribution</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Rules List" />
            <Tab label="Results Detail" />
          </Tabs>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <Chip
            key={cat}
            label={cat === 'all' ? 'All Categories' : cat}
            onClick={() => setSelectedCategory(cat)}
            variant={selectedCategory === cat ? 'filled' : 'outlined'}
            color={selectedCategory === cat ? 'primary' : 'default'}
          />
        ))}
      </Box>

      {activeTab === 0 ? (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Rule</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Category</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Severity</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Pass Rate</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Failed Records</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Last Run</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Enabled</Typography></TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Actions</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRules.map((rule) => {
                  const cat = categoryConfig[rule.category];
                  const sev = severityConfig[rule.severity];
                  return (
                    <TableRow key={rule.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{rule.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{rule.description}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={cat.icon}
                          label={rule.category}
                          size="small"
                          sx={{ bgcolor: alpha(cat.color, 0.12), color: cat.color }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sev.label}
                          size="small"
                          sx={{ bgcolor: alpha(sev.color, 0.12), color: sev.color, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={rule.passRate}
                            sx={{
                              width: 80,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: alpha(rule.passRate >= 99.9 ? '#2E7D32' : rule.passRate >= 99 ? '#ED6C02' : '#D32F2F', 0.12),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: rule.passRate >= 99.9 ? '#2E7D32' : rule.passRate >= 99 ? '#ED6C02' : '#D32F2F',
                              },
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{rule.passRate}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={rule.failedRecords > 0 ? 'error.main' : 'success.main'}
                          sx={{ fontWeight: 600 }}
                        >
                          {rule.failedRecords.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{new Date(rule.lastRun).toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule.id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Run Rule">
                            <IconButton size="small" color="primary"><RunIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small"><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDeleteRule(rule.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredRules.map((rule) => {
            const cat = categoryConfig[rule.category];
            const sev = severityConfig[rule.severity];
            return (
              <Grid size={{ xs: 12, md: 6 }} key={rule.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: alpha(cat.color, 0.12), color: cat.color, width: 40, height: 40 }}>
                          {cat.icon}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{rule.name}</Typography>
                          <Chip label={sev.label} size="small" sx={{ bgcolor: alpha(sev.color, 0.12), color: sev.color }} />
                        </Box>
                      </Box>
                      {rule.passRate === 100 ? (
                        <PassedIcon sx={{ color: '#2E7D32' }} />
                      ) : (
                        <FailedIcon sx={{ color: '#D32F2F' }} />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{rule.description}</Typography>
                    {rule.expression && (
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 1, mb: 2, fontFamily: 'monospace', fontSize: 12 }}>
                        {rule.expression}
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Pass rate: <strong>{rule.passRate}%</strong> | Failed: <strong>{rule.failedRecords.toLocaleString()}</strong>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Validation Rule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Rule Name" fullWidth />
            <TextField label="Description" fullWidth multiline rows={2} />
            <TextField label="Category" select fullWidth defaultValue="Data Quality">
              {Object.keys(categoryConfig).map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </TextField>
            <TextField label="Severity" select fullWidth defaultValue="warning">
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </TextField>
            <TextField label="Validation Expression" fullWidth placeholder="e.g., column_name IS NOT NULL" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setDialogOpen(false)}>Add Rule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataValidation;
