import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import NewInvoiceDialog from '../components/NewInvoiceDialog';
import { useDeleteInvoice, useInvoice, useInvoices, useUpdateInvoiceStatus } from '../hooks/useInvoices';
import type { Client, Invoice, InvoiceListFilters, InvoiceStatus } from '../types/api';
import { INVOICE_STATUS_COLORS, downloadBlob, formatCurrency, getApiError } from '../utils/billing';

type TargetStatus = Exclude<InvoiceStatus, 'draft'>;

const STATUS_ACTIONS: Record<InvoiceStatus, { status: TargetStatus; label: string }[]> = {
  draft: [
    { status: 'issued', label: 'Issue' },
    { status: 'void', label: 'Void' },
  ],
  issued: [
    { status: 'paid', label: 'Mark paid' },
    { status: 'void', label: 'Void' },
  ],
  paid: [],
  void: [],
};

const InvoicesPage: React.FC = () => {
  const [filters, setFilters] = useState<InvoiceListFilters>({});
  const [newOpen, setNewOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const { data: invoicesData, isLoading } = useInvoices(filters);
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });
  const { data: detail, isLoading: detailLoading } = useInvoice(viewingId);
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();

  const invoices = invoicesData?.invoices ?? [];
  const clients: Client[] = clientsData?.clients ?? [];
  const hasFilters = filters.clientId !== undefined || filters.status !== undefined;

  const handleStatusChange = (invoice: Invoice, status: TargetStatus) => {
    if (status === 'void' && !window.confirm(`Void invoice ${invoice.invoice_number}? Its work entries will become billable again.`)) {
      return;
    }
    updateStatus.mutate(
      { id: invoice.id, status },
      { onError: (err) => setError(getApiError(err).message || 'Failed to update invoice status') }
    );
  };

  const handleDelete = (invoice: Invoice) => {
    if (window.confirm(`Delete draft invoice ${invoice.invoice_number}?`)) {
      deleteInvoice.mutate(invoice.id, {
        onSuccess: () => setViewingId(null),
        onError: (err) => setError(getApiError(err).message || 'Failed to delete invoice'),
      });
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      const blob = await apiClient.downloadInvoicePdf(invoice.id);
      downloadBlob(blob, `${invoice.invoice_number}.pdf`);
    } catch {
      setError('Failed to download invoice PDF');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Invoices</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
          New Invoice
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Client</InputLabel>
          <Select
            label="Client"
            value={filters.clientId ?? ''}
            onChange={(e) =>
              setFilters({ ...filters, clientId: String(e.target.value) === '' ? undefined : Number(e.target.value) })
            }
          >
            <MenuItem value="">All clients</MenuItem>
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters({ ...filters, status: String(e.target.value) === '' ? undefined : (e.target.value as InvoiceStatus) })
            }
          >
            <MenuItem value="">All statuses</MenuItem>
            {(Object.keys(STATUS_ACTIONS) as InvoiceStatus[]).map((status) => (
              <MenuItem key={status} value={status} sx={{ textTransform: 'capitalize' }}>
                {status}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {invoice.invoice_number}
                      </Typography>
                    </TableCell>
                    <TableCell>{invoice.client_name}</TableCell>
                    <TableCell>
                      {invoice.period_start} – {invoice.period_end}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(invoice.total, invoice.currency)}</TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status}
                        color={INVOICE_STATUS_COLORS[invoice.status]}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end" alignItems="center" gap={0.5}>
                        {STATUS_ACTIONS[invoice.status].map((action) => (
                          <Button
                            key={action.status}
                            size="small"
                            color={action.status === 'void' ? 'error' : 'primary'}
                            onClick={() => handleStatusChange(invoice, action.status)}
                            disabled={updateStatus.isPending}
                          >
                            {action.label}
                          </Button>
                        ))}
                        <Tooltip title="View">
                          <IconButton size="small" color="primary" onClick={() => setViewingId(invoice.id)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton size="small" color="primary" onClick={() => handleDownload(invoice)}>
                            <PdfIcon />
                          </IconButton>
                        </Tooltip>
                        {invoice.status === 'draft' && (
                          <Tooltip title="Delete draft">
                            <IconButton size="small" color="error" onClick={() => handleDelete(invoice)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box py={3}>
                      <Typography color="text.secondary" sx={{ mb: hasFilters ? 0 : 2 }}>
                        {hasFilters
                          ? 'No invoices match the selected filters.'
                          : 'No invoices yet. Generate one from your unbilled work entries.'}
                      </Typography>
                      {!hasFilters && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
                          New Invoice
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {newOpen && (
        <NewInvoiceDialog
          open
          clients={clients}
          onClose={() => setNewOpen(false)}
          onCreated={(invoice) => {
            setNewOpen(false);
            setViewingId(invoice.id);
          }}
        />
      )}

      <Dialog open={viewingId !== null} onClose={() => setViewingId(null)} maxWidth="md" fullWidth>
        <DialogTitle>{detail ? `Invoice ${detail.invoice.invoice_number}` : 'Invoice'}</DialogTitle>
        <DialogContent>
          {detailLoading || !detail ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Bill to</Typography>
                  <Typography>{detail.invoice.client_name}</Typography>
                  {detail.invoice.client_email && <Typography>{detail.invoice.client_email}</Typography>}
                  {detail.invoice.billing_address && (
                    <Typography sx={{ whiteSpace: 'pre-line' }}>{detail.invoice.billing_address}</Typography>
                  )}
                </Box>
                <Box textAlign="right">
                  <Chip
                    label={detail.invoice.status}
                    color={INVOICE_STATUS_COLORS[detail.invoice.status]}
                    size="small"
                    sx={{ textTransform: 'capitalize', mb: 1 }}
                  />
                  <Typography variant="body2">
                    Period: {detail.invoice.period_start} – {detail.invoice.period_end}
                  </Typography>
                  {detail.invoice.issue_date && (
                    <Typography variant="body2">Issued: {detail.invoice.issue_date}</Typography>
                  )}
                  {detail.invoice.due_date && (
                    <Typography variant="body2">Due: {detail.invoice.due_date}</Typography>
                  )}
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.entry_date}</TableCell>
                        <TableCell>{item.description || '-'}</TableCell>
                        <TableCell align="right">{item.hours}</TableCell>
                        <TableCell align="right">{formatCurrency(item.rate, detail.invoice.currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.amount, detail.invoice.currency)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography fontWeight="medium">Total</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">{detail.invoice.total_hours}</Typography>
                      </TableCell>
                      <TableCell />
                      <TableCell align="right">
                        <Typography fontWeight="medium">
                          {formatCurrency(detail.invoice.total, detail.invoice.currency)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              {detail.invoice.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Notes: {detail.invoice.notes}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {detail && (
            <Button startIcon={<PdfIcon />} onClick={() => handleDownload(detail.invoice)}>
              Download PDF
            </Button>
          )}
          <Button onClick={() => setViewingId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicesPage;
