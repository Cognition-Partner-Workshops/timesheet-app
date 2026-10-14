import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  Avatar,
  Tabs,
  Tab,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as FailureIcon,
  Warning as WarningIcon,
  SwapHoriz as TransferIcon,
  CheckCircle as ValidationIcon,
  VerifiedUser as VerificationIcon,
  Undo as RollbackIcon,
  Settings as ConfigIcon,
  Fingerprint as ChecksumIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { auditRecords as initialAudit } from '../data/mockData';
import type { AuditRecord } from '../data/mockData';


const actionConfig: Record<string, { icon: React.ReactElement; color: string; label: string }> = {
  transfer: { icon: <TransferIcon />, color: '#1565C0', label: 'Transfer' },
  validation: { icon: <ValidationIcon />, color: '#2E7D32', label: 'Validation' },
  verification: { icon: <VerificationIcon />, color: '#00897B', label: 'Verification' },
  rollback: { icon: <RollbackIcon />, color: '#ED6C02', label: 'Rollback' },
  config_change: { icon: <ConfigIcon />, color: '#9C27B0', label: 'Config Change' },
};

const statusConfig = {
  success: { color: '#2E7D32', icon: <SuccessIcon sx={{ fontSize: 18 }} /> },
  failure: { color: '#D32F2F', icon: <FailureIcon sx={{ fontSize: 18 }} /> },
  warning: { color: '#ED6C02', icon: <WarningIcon sx={{ fontSize: 18 }} /> },
};

const Verification: React.FC = () => {
  const theme = useTheme();
  const [records] = useState<AuditRecord[]>(initialAudit);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.details.toLowerCase().includes(search.toLowerCase()) ||
      r.source.toLowerCase().includes(search.toLowerCase()) ||
      r.user.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || r.action === actionFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesAction && matchesStatus;
  });

  const successCount = records.filter((r) => r.status === 'success').length;
  const failureCount = records.filter((r) => r.status === 'failure').length;
  const warningCount = records.filter((r) => r.status === 'warning').length;
  const totalAffected = records.reduce((sum, r) => sum + r.recordsAffected, 0);
  const checksumVerified = records.filter((r) => r.checksum).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Verification & Audit Trail
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Complete audit trail with checksum verification and data reconciliation
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />}>Export Report</Button>
          <Button variant="outlined" startIcon={<RefreshIcon />}>Refresh</Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{records.length}</Typography>
              <Typography variant="caption" color="text.secondary">Total Events</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="success.main">{successCount}</Typography>
              <Typography variant="caption" color="text.secondary">Successful</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="error.main">{failureCount}</Typography>
              <Typography variant="caption" color="text.secondary">Failures</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="warning.main">{warningCount}</Typography>
              <Typography variant="caption" color="text.secondary">Warnings</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{(totalAffected / 1000000).toFixed(1)}M</Typography>
              <Typography variant="caption" color="text.secondary">Records Affected</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                <ChecksumIcon color="success" sx={{ fontSize: 20 }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>{checksumVerified}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Checksums Verified</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab icon={<TimelineIcon />} label="Audit Log" iconPosition="start" />
            <Tab icon={<ChecksumIcon />} label="Checksum Verification" iconPosition="start" />
          </Tabs>
        </Box>
      </Card>

      {activeTab === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search audit trail..."
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 300 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Action"
              select
              size="small"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              sx={{ width: 160 }}
            >
              <MenuItem value="all">All Actions</MenuItem>
              {Object.entries(actionConfig).map(([key, val]) => (
                <MenuItem key={key} value={key}>{val.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ width: 140 }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failure">Failure</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
            </TextField>
            <Chip label={`${filteredRecords.length} results`} variant="outlined" />
          </Box>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Timestamp</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Action</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Status</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>User</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Source / Destination</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Details</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Records</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Checksum</Typography></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const action = actionConfig[record.action];
                    const status = statusConfig[record.status];
                    return (
                      <TableRow key={record.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                        <TableCell>
                          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                            {new Date(record.timestamp).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={action.icon}
                            label={action.label}
                            size="small"
                            sx={{ bgcolor: alpha(action.color, 0.12), color: action.color, fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={status.icon}
                            label={record.status}
                            size="small"
                            sx={{ bgcolor: alpha(status.color, 0.12), color: status.color, fontWeight: 600, textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={record.user} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="caption"sx={{ fontWeight: 500 }}>{record.source}</Typography>
                            {record.destination && (
                              <Typography variant="caption" color="text.secondary"> → {record.destination}</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="caption" color="text.secondary">
                            {record.details}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2"sx={{ fontWeight: 500 }}>
                            {record.recordsAffected.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {record.checksum ? (
                            <Tooltip title={record.checksum}>
                              <Chip
                                icon={<ChecksumIcon sx={{ fontSize: 14 }} />}
                                label="Verified"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {records
            .filter((r) => r.checksum)
            .map((record) => (
              <Grid size={{ xs: 12, md: 6 }} key={record.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: alpha('#2E7D32', 0.12), color: '#2E7D32' }}>
                          <ChecksumIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {record.source} {record.destination ? `→ ${record.destination}` : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(record.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        icon={<SuccessIcon sx={{ fontSize: 14 }} />}
                        label="Verified"
                        color="success"
                        size="small"
                      />
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Checksum Algorithm</Typography>
                        <Typography variant="caption"sx={{ fontWeight: 500 }}>SHA-256</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Hash Value</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{record.checksum}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Records Verified</Typography>
                        <Typography variant="caption"sx={{ fontWeight: 500 }}>{record.recordsAffected.toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Source Match</Typography>
                        <Chip label="Match" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Destination Match</Typography>
                        <Chip label="Match" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}
    </Box>
  );
};

export default Verification;
