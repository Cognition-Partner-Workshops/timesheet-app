import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  InputAdornment,
  useTheme,
  alpha,
  Avatar,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ConnectedIcon,
  Cancel as DisconnectedIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Stream as KafkaIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { DataSource, dataSources as initialSources } from '../data/mockData';

const typeIcons: Record<string, React.ReactElement> = {
  'Oracle DB': <StorageIcon />,
  'SQL Server': <StorageIcon />,
  'PostgreSQL': <StorageIcon />,
  'S3 Bucket': <CloudIcon />,
  'Azure Blob': <CloudIcon />,
  'Kafka': <KafkaIcon />,
  'REST API': <StorageIcon />,
  'Flat File': <FileIcon />,
};

const statusConfig = {
  connected: { color: '#2E7D32', icon: <ConnectedIcon sx={{ fontSize: 16 }} />, label: 'Connected' },
  disconnected: { color: '#9E9E9E', icon: <DisconnectedIcon sx={{ fontSize: 16 }} />, label: 'Disconnected' },
  error: { color: '#D32F2F', icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: 'Error' },
};

const sourceTypes: DataSource['type'][] = ['Oracle DB', 'SQL Server', 'PostgreSQL', 'S3 Bucket', 'Azure Blob', 'Kafka', 'REST API', 'Flat File'];

const DataSources: React.FC = () => {
  const theme = useTheme();
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [newSource, setNewSource] = useState<Partial<DataSource>>({
    name: '',
    type: 'PostgreSQL',
    host: '',
    database: '',
    schema: '',
    status: 'disconnected',
  });

  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSource = () => {
    const source: DataSource = {
      id: `ds-${String(sources.length + 1).padStart(3, '0')}`,
      name: newSource.name || 'New Source',
      type: newSource.type || 'PostgreSQL',
      host: newSource.host || 'localhost',
      database: newSource.database,
      schema: newSource.schema,
      status: 'disconnected',
      lastSync: new Date().toISOString(),
      recordCount: 0,
    };
    setSources([...sources, source]);
    setDialogOpen(false);
    setNewSource({ name: '', type: 'PostgreSQL', host: '', database: '', schema: '', status: 'disconnected' });
  };

  const handleDelete = (id: string) => {
    setSources(sources.filter((s) => s.id !== id));
  };

  const handleTestConnection = (id: string) => {
    setSources(
      sources.map((s) =>
        s.id === id ? { ...s, status: 'connected' as const, lastSync: new Date().toISOString() } : s
      )
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Data Sources
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and monitor all connected data sources in the enterprise
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} size="large">
          Add Data Source
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Search sources..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Chip label={`${filteredSources.length} sources`} variant="outlined" />
        <Chip
          label={`${sources.filter((s) => s.status === 'connected').length} connected`}
          color="success"
          variant="outlined"
        />
        <Chip
          label={`${sources.filter((s) => s.status === 'error').length} errors`}
          color="error"
          variant="outlined"
        />
      </Box>

      <Grid container spacing={3}>
        {filteredSources.map((source) => {
          const status = statusConfig[source.status];
          return (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={source.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  border: source.status === 'error' ? `1px solid ${alpha('#D32F2F', 0.3)}` : 'none',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: theme.palette.primary.main,
                        }}
                      >
                        {typeIcons[source.type] || <StorageIcon />}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {source.name}
                        </Typography>
                        <Chip label={source.type} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Chip
                      icon={status.icon}
                      label={status.label}
                      size="small"
                      sx={{
                        bgcolor: alpha(status.color, 0.12),
                        color: status.color,
                        fontWeight: 600,
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Host</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
                        {source.host}
                      </Typography>
                    </Box>
                    {source.database && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Database</Typography>
                        <Typography variant="caption"sx={{ fontWeight: 500 }}>{source.database}</Typography>
                      </Box>
                    )}
                    {source.schema && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Schema</Typography>
                        <Typography variant="caption"sx={{ fontWeight: 500 }}>{source.schema}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Records</Typography>
                      <Typography variant="caption"sx={{ fontWeight: 500 }}>{source.recordCount.toLocaleString()}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Last Sync</Typography>
                      <Typography variant="caption"sx={{ fontWeight: 500 }}>
                        {new Date(source.lastSync).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Tooltip title="Test Connection">
                      <IconButton size="small" color="primary" onClick={() => handleTestConnection(source.id)}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditSource(source)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(source.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Data Source</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Source Name"
              fullWidth
              value={newSource.name}
              onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
            />
            <TextField
              label="Source Type"
              select
              fullWidth
              value={newSource.type}
              onChange={(e) => setNewSource({ ...newSource, type: e.target.value as DataSource['type'] })}
            >
              {sourceTypes.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Host / Connection String"
              fullWidth
              value={newSource.host}
              onChange={(e) => setNewSource({ ...newSource, host: e.target.value })}
            />
            <TextField
              label="Database"
              fullWidth
              value={newSource.database}
              onChange={(e) => setNewSource({ ...newSource, database: e.target.value })}
            />
            <TextField
              label="Schema"
              fullWidth
              value={newSource.schema}
              onChange={(e) => setNewSource({ ...newSource, schema: e.target.value })}
            />
            <FormControlLabel
              control={<Switch />}
              label="Enable SSL/TLS encryption"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSource}>Add Source</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editSource} onClose={() => setEditSource(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Data Source</DialogTitle>
        <DialogContent>
          {editSource && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField label="Source Name" fullWidth defaultValue={editSource.name} />
              <TextField label="Host" fullWidth defaultValue={editSource.host} />
              <TextField label="Database" fullWidth defaultValue={editSource.database} />
              <TextField label="Schema" fullWidth defaultValue={editSource.schema} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setEditSource(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => setEditSource(null)}>Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataSources;
