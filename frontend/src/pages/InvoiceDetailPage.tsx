import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import { Download as DownloadIcon, Edit as EditIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/client';
import type { InvoiceParty } from '../types/api';
import { formatMoney } from '../utils/money';
import { apiErrorMessage } from '../utils/errors';
import InvoiceStatusChip from '../components/invoices/InvoiceStatusChip';

type DialogKind = 'issue' | 'delete' | 'mark-paid' | 'void' | null;

const Party: React.FC<{ title: string; party: InvoiceParty | null; fallback: string }> = ({ title, party, fallback }) => (
  <Box>
    <Typography variant="overline" color="text.secondary">{title}</Typography>
    {party ? (
      <>
        <Typography fontWeight="medium">{party.name}</Typography>
        {party.address && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{party.address}</Typography>}
        {party.email && <Typography variant="body2">{party.email}</Typography>}
        {party.taxId && <Typography variant="body2">Tax ID: {party.taxId}</Typography>}
      </>
    ) : (
      <Typography variant="body2" color="text.secondary">{fallback}</Typography>
    )}
  </Box>
);

const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string>((location.state as { error?: string } | null)?.error || '');

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => apiClient.getInvoice(invoiceId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    queryClient.invalidateQueries({ queryKey: ['workEntries'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (kind: Exclude<DialogKind, null> | 'mark-unpaid') => {
      if (kind === 'delete') return apiClient.deleteInvoice(invoiceId);
      const body = kind === 'mark-paid' ? { paidDate } : kind === 'void' ? { reason: voidReason } : {};
      return apiClient.invoiceAction(invoiceId, kind, body);
    },
    onSuccess: (_, kind) => {
      setDialog(null);
      setError('');
      refresh();
      if (kind === 'delete') navigate('/invoices');
    },
    onError: (err) => {
      setDialog(null);
      setError(apiErrorMessage(err, 'Action failed'));
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => apiClient.downloadInvoicePdf(invoiceId),
    onSuccess: ({ blob, filename }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Failed to download PDF')),
  });

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (loadError || !data) return <Alert severity="error">Invoice not found</Alert>;

  const invoice = data.invoice;
  const lines = invoice.lines || [];
  const busy = actionMutation.isPending;
  const money = (cents: number | null) => formatMoney(cents, invoice.currency);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h4">{invoice.invoice_number || `Draft invoice #${invoice.id}`}</Typography>
          <InvoiceStatusChip status={invoice.status} overdue={invoice.is_overdue} />
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          {invoice.status === 'draft' && (
            <>
              <Button startIcon={<EditIcon />} onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>Edit</Button>
              <Button color="error" onClick={() => setDialog('delete')}>Delete</Button>
              <Button variant="contained" onClick={() => setDialog('issue')}>Issue</Button>
            </>
          )}
          {invoice.status === 'issued' && (
            <Button variant="contained" color="success" onClick={() => setDialog('mark-paid')}>Mark paid</Button>
          )}
          {invoice.status === 'paid' && (
            <Button onClick={() => actionMutation.mutate('mark-unpaid')} disabled={busy}>Mark unpaid</Button>
          )}
          {(invoice.status === 'issued' || invoice.status === 'paid') && (
            <Button color="error" onClick={() => setDialog('void')}>Void</Button>
          )}
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
            PDF
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {invoice.is_overdue && <Alert severity="error" sx={{ mb: 2 }}>This invoice was due on {invoice.due_date} and is unpaid.</Alert>}
      {invoice.status === 'void' && (
        <Alert severity="warning" sx={{ mb: 2 }}>Voided{invoice.void_reason ? `: ${invoice.void_reason}` : ''}. Its work entries are unbilled again.</Alert>
      )}
      {invoice.status === 'paid' && invoice.paid_at && <Alert severity="success" sx={{ mb: 2 }}>Paid on {invoice.paid_at}.</Alert>}

      <Paper sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={3} mb={3}>
          <Party title="From" party={invoice.sender_snapshot} fallback="Your billing settings (captured when issued)" />
          <Party title="Bill to" party={invoice.client_snapshot} fallback={invoice.client_name} />
          <Box>
            <Typography variant="body2"><strong>Issue date:</strong> {invoice.issue_date}</Typography>
            <Typography variant="body2"><strong>Due date:</strong> {invoice.due_date}</Typography>
            {(invoice.period_start || invoice.period_end) && (
              <Typography variant="body2"><strong>Period:</strong> {invoice.period_start || '…'} to {invoice.period_end || '…'}</Typography>
            )}
          </Box>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Qty/Hours</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No line items</TableCell></TableRow>
            ) : lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.date || ''}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell align="right">{l.quantity}</TableCell>
                <TableCell align="right">{money(l.unit_price_cents)}</TableCell>
                <TableCell align="right">{money(l.amount_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box maxWidth={320} ml="auto" mt={2}>
          <Box display="flex" justifyContent="space-between"><span>Subtotal</span><span>{money(invoice.subtotal_cents)}</span></Box>
          <Box display="flex" justifyContent="space-between"><span>Tax ({invoice.tax_rate_bp / 100}%)</span><span>{money(invoice.tax_cents)}</span></Box>
          <Box display="flex" justifyContent="space-between" fontWeight="bold" mt={1}><span>Total</span><span>{money(invoice.total_cents)}</span></Box>
        </Box>

        {invoice.notes && (
          <Box mt={3}>
            <Typography variant="overline" color="text.secondary">Notes</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{invoice.notes}</Typography>
          </Box>
        )}
      </Paper>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {{ issue: 'Issue invoice?', delete: 'Delete draft?', 'mark-paid': 'Mark as paid', void: 'Void invoice' }[dialog || 'issue']}
        </DialogTitle>
        <DialogContent>
          {dialog === 'issue' && (
            <DialogContentText>The invoice gets its number and can no longer be edited. To correct it later you'll need to void it and create a new one.</DialogContentText>
          )}
          {dialog === 'delete' && <DialogContentText>The draft is deleted and its work entries become unbilled.</DialogContentText>}
          {dialog === 'mark-paid' && (
            <TextField type="date" label="Payment date" fullWidth margin="dense" InputLabelProps={{ shrink: true }}
              value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          )}
          {dialog === 'void' && (
            <>
              <DialogContentText>The invoice keeps its number but is no longer owed. Its work entries become unbilled so you can bill them on a new invoice.</DialogContentText>
              <TextField label="Reason" fullWidth required margin="dense" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            color={dialog === 'delete' || dialog === 'void' ? 'error' : 'primary'}
            disabled={busy || (dialog === 'void' && !voidReason.trim())}
            onClick={() => dialog && actionMutation.mutate(dialog)}
          >
            {busy ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceDetailPage;
