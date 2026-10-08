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
  TablePagination,
  TextField,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import apiClient from '../api/client';
import type { Client, InvoiceListFilters } from '../types/api';
import { formatMoney } from '../utils/money';
import InvoiceStatusChip from '../components/invoices/InvoiceStatusChip';

const STATUS_OPTIONS = ['', 'draft', 'issued', 'overdue', 'paid', 'void'] as const;

const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const filters: InvoiceListFilters = {
    status: (status || undefined) as InvoiceListFilters['status'],
    clientId: clientId ? Number(clientId) : undefined,
    page: page + 1,
    pageSize,
  };

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => apiClient.getInvoices(filters),
  });

  const clients: Client[] = clientsData?.clients || [];
  const invoices = data?.invoices || [];
  const summary = data?.summary || [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h4">Invoices</Typography>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<SettingsIcon />} component={RouterLink} to="/settings/billing">
            Billing settings
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/invoices/new')}
            disabled={clients.length === 0}
          >
            New invoice
          </Button>
        </Box>
      </Box>

      {clientsData && clients.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button component={RouterLink} to="/clients">Add client</Button>}>
          Add a client before creating invoices.
        </Alert>
      )}

      {summary.length > 0 && (
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(240px, 1fr))" gap={2} mb={3}>
          {summary.map((s) => (
            <Card key={s.currency}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">{s.currency}</Typography>
                <Typography variant="body2">Outstanding: <strong>{formatMoney(s.outstanding_cents, s.currency)}</strong></Typography>
                <Typography variant="body2" color={s.overdue_cents > 0 ? 'error' : 'text.primary'}>
                  Overdue: <strong>{formatMoney(s.overdue_cents, s.currency)}</strong>
                </Typography>
                <Typography variant="body2">Paid: {formatMoney(s.paid_cents, s.currency)}</Typography>
                <Typography variant="body2" color="text.secondary">Drafts: {formatMoney(s.draft_cents, s.currency)}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Box display="flex" gap={2} mb={2}>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
        >
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Client"
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); setPage(0); }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All clients</MenuItem>
          {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load invoices</Alert>}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Issue date</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
                </TableRow>
              ) : invoices.length > 0 ? (
                invoices.map((inv) => (
                  <TableRow key={inv.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <TableCell>{inv.invoice_number || <Typography variant="body2" color="text.secondary">Draft #{inv.id}</Typography>}</TableCell>
                    <TableCell>{inv.client_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell align="right">{formatMoney(inv.total_cents, inv.currency)}</TableCell>
                    <TableCell><InvoiceStatusChip status={inv.status} overdue={inv.is_overdue} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No invoices yet. Create one from your unbilled work entries.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.pagination.total || 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
        />
      </Paper>
    </Box>
  );
};

export default InvoicesPage;
