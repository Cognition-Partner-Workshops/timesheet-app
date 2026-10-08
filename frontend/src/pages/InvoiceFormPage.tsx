import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import type { Client, Invoice, InvoiceInput, InvoiceLineInput } from '../types/api';
import { centsToInput, formatMoney, lineAmountCents, parseMoneyInput, taxCents } from '../utils/money';
import { apiErrorMessage } from '../utils/errors';

interface EntryRow {
  id: number;
  date: string;
  description: string | null;
  hours: number;
}

interface EntryOverride {
  selected: boolean;
  rate?: string;
}

interface ManualLine {
  key: number;
  description: string;
  quantity: string;
  rate: string;
}

interface FormInitial {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: string;
  notes: string;
  overrides: Record<number, EntryOverride>;
  manualLines: ManualLine[];
  invoiceEntries: EntryRow[];
}

let manualKey = 0;

function initialFromInvoice(invoice: Invoice): FormInitial {
  const lines = invoice.lines || [];
  const overrides: Record<number, EntryOverride> = {};
  const invoiceEntries: EntryRow[] = [];
  const manualLines: ManualLine[] = [];
  lines.forEach((l) => {
    if (l.work_entry_id) {
      overrides[l.work_entry_id] = { selected: true, rate: centsToInput(l.unit_price_cents) };
      invoiceEntries.push({ id: l.work_entry_id, date: l.date || '', description: l.description, hours: l.quantity });
    } else {
      manualLines.push({ key: ++manualKey, description: l.description, quantity: String(l.quantity), rate: centsToInput(l.unit_price_cents) });
    }
  });
  return {
    clientId: String(invoice.client_id),
    periodStart: invoice.period_start || '',
    periodEnd: invoice.period_end || '',
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    currency: invoice.currency,
    taxRate: (invoice.tax_rate_bp / 100).toString(),
    notes: invoice.notes || '',
    overrides,
    manualLines,
    invoiceEntries,
  };
}

const EMPTY_INITIAL: FormInitial = {
  clientId: '',
  periodStart: '',
  periodEnd: '',
  issueDate: '',
  dueDate: '',
  currency: '',
  taxRate: '',
  notes: '',
  overrides: {},
  manualLines: [],
  invoiceEntries: [],
};

const InvoiceForm: React.FC<{ invoiceId?: number; initial: FormInitial; clients: Client[] }> = ({ invoiceId, initial, clients }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [confirmIssue, setConfirmIssue] = useState(false);
  const isEdit = invoiceId !== undefined;
  const clientId = form.clientId ? Number(form.clientId) : undefined;

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['invoicePreview', clientId, form.periodStart, form.periodEnd],
    queryFn: () => apiClient.getInvoicePreview({
      clientId: clientId as number,
      from: form.periodStart || undefined,
      to: form.periodEnd || undefined,
    }),
    enabled: clientId !== undefined,
  });

  const defaults = preview?.defaults;
  const currency = form.currency || defaults?.currency || 'USD';
  const defaultRate = centsToInput(defaults?.hourlyRateCents ?? null);
  const taxRateBp = Math.round(Number(form.taxRate !== '' ? form.taxRate : (defaults?.taxRateBp ?? 0) / 100) * 100);

  const entries: EntryRow[] = useMemo(() => {
    const byId = new Map<number, EntryRow>();
    form.invoiceEntries.forEach((e) => byId.set(e.id, e));
    (preview?.entries || []).forEach((e) => byId.set(e.id, { ...e, hours: Number(e.hours) }));
    return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  }, [preview, form.invoiceEntries]);

  const entryState = (id: number) => form.overrides[id] || { selected: !isEdit };
  const entryRate = (id: number) => entryState(id).rate ?? defaultRate;
  const selectedEntries = entries.filter((e) => entryState(e.id).selected);

  const lineTotals = [
    ...selectedEntries.map((e) => lineAmountCents(e.hours, parseMoneyInput(entryRate(e.id)))),
    ...form.manualLines.map((l) => lineAmountCents(Number(l.quantity || 0), parseMoneyInput(l.rate))),
  ];
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const tax = taxCents(subtotal, taxRateBp);
  const missingRate = selectedEntries.some((e) => parseMoneyInput(entryRate(e.id)) === null)
    || form.manualLines.some((l) => parseMoneyInput(l.rate) === null);

  const setOverride = (id: number, patch: Partial<EntryOverride>) =>
    setForm((f) => ({ ...f, overrides: { ...f.overrides, [id]: { ...entryState(id), ...f.overrides[id], ...patch } } }));

  const allSelected = entries.length > 0 && selectedEntries.length === entries.length;
  const toggleAll = () => {
    const overrides = { ...form.overrides };
    entries.forEach((e) => { overrides[e.id] = { ...entryState(e.id), selected: !allSelected }; });
    setForm({ ...form, overrides });
  };

  const buildPayload = (): InvoiceInput => {
    const lines: InvoiceLineInput[] = [
      ...selectedEntries.map((e) => ({ workEntryId: e.id, unitPriceCents: parseMoneyInput(entryRate(e.id)) })),
      ...form.manualLines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity || 1),
        unitPriceCents: parseMoneyInput(l.rate),
      })),
    ];
    return {
      ...(isEdit ? {} : { clientId }),
      periodStart: form.periodStart || null,
      periodEnd: form.periodEnd || null,
      issueDate: form.issueDate || undefined,
      dueDate: form.dueDate || undefined,
      currency: form.currency || undefined,
      taxRateBp: form.taxRate !== '' ? taxRateBp : undefined,
      notes: form.notes || null,
      lines,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (issue: boolean) => {
      const payload = buildPayload();
      const saved = isEdit
        ? await apiClient.updateInvoice(invoiceId, payload)
        : await apiClient.createInvoice(payload);
      let issueError: string | undefined;
      if (issue) {
        try {
          await apiClient.invoiceAction(saved.invoice.id, 'issue');
        } catch (err) {
          issueError = apiErrorMessage(err, 'Failed to issue invoice');
        }
      }
      return { id: saved.invoice.id, issueError };
    },
    onSuccess: ({ id, issueError }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['workEntries'] });
      navigate(`/invoices/${id}`, { state: issueError ? { error: issueError } : undefined });
    },
    onError: (err) => {
      setConfirmIssue(false);
      setError(apiErrorMessage(err, 'Failed to save invoice'));
    },
  });

  const busy = saveMutation.isPending;
  const canSave = clientId !== undefined && !busy;

  return (
    <Box>
      <Typography variant="h4" mb={3}>{isEdit ? 'Edit draft invoice' : 'New invoice'}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>1. Client and billing period</Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            select
            label="Client"
            value={form.clientId}
            disabled={isEdit || busy}
            onChange={(e) => setForm({ ...EMPTY_INITIAL, clientId: e.target.value })}
            sx={{ minWidth: 240 }}
          >
            {clients.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Period start" InputLabelProps={{ shrink: true }} value={form.periodStart}
            onChange={(e) => setForm({ ...form, periodStart: e.target.value })} disabled={busy} />
          <TextField type="date" label="Period end" InputLabelProps={{ shrink: true }} value={form.periodEnd}
            onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} disabled={busy} />
        </Box>
        {preview && preview.client.hourly_rate_cents == null && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This client has no default hourly rate. Enter a rate on each line, or set one on the Clients page.
          </Alert>
        )}
      </Paper>

      {clientId !== undefined && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>2. Unbilled work entries</Typography>
            {previewLoading && !preview ? <CircularProgress size={24} /> : entries.length === 0 ? (
              <Typography color="text.secondary">No unbilled work entries for this client and period.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allSelected} indeterminate={!allSelected && selectedEntries.length > 0} onChange={toggleAll} inputProps={{ 'aria-label': 'Select all entries' }} />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Hours</TableCell>
                    <TableCell align="right">Rate ({currency})</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e) => {
                    const state = entryState(e.id);
                    const rate = entryRate(e.id);
                    return (
                      <TableRow key={e.id} selected={state.selected}>
                        <TableCell padding="checkbox">
                          <Checkbox checked={state.selected} onChange={(ev) => setOverride(e.id, { selected: ev.target.checked })} inputProps={{ 'aria-label': `Select entry ${e.date}` }} />
                        </TableCell>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>{e.description || '—'}</TableCell>
                        <TableCell align="right">{e.hours}</TableCell>
                        <TableCell align="right">
                          <TextField size="small" type="number" value={rate} disabled={!state.selected || busy}
                            inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' }, 'aria-label': `Rate for ${e.date}` }}
                            onChange={(ev) => setOverride(e.id, { rate: ev.target.value })} sx={{ width: 110 }} />
                        </TableCell>
                        <TableCell align="right">
                          {state.selected ? formatMoney(lineAmountCents(e.hours, parseMoneyInput(rate)), currency) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6">3. Other line items</Typography>
              <Button startIcon={<AddIcon />} disabled={busy} onClick={() => setForm({
                ...form,
                manualLines: [...form.manualLines, { key: ++manualKey, description: '', quantity: '1', rate: '' }],
              })}>Add line</Button>
            </Box>
            {form.manualLines.length === 0 && (
              <Typography color="text.secondary">Add fixed fees or expenses that aren't tracked as work entries.</Typography>
            )}
            {form.manualLines.map((line, idx) => {
              const update = (patch: Partial<ManualLine>) => setForm({
                ...form,
                manualLines: form.manualLines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
              });
              return (
                <Box key={line.key} display="flex" gap={2} alignItems="center" mb={1}>
                  <TextField size="small" label="Description" value={line.description} required
                    onChange={(e) => update({ description: e.target.value })} sx={{ flex: 1 }} disabled={busy} />
                  <TextField size="small" label="Qty" type="number" value={line.quantity}
                    onChange={(e) => update({ quantity: e.target.value })} sx={{ width: 90 }} disabled={busy} inputProps={{ min: 0.01, step: 0.01 }} />
                  <TextField size="small" label={`Rate (${currency})`} type="number" value={line.rate}
                    onChange={(e) => update({ rate: e.target.value })} sx={{ width: 130 }} disabled={busy} inputProps={{ min: 0, step: 0.01 }} />
                  <Typography sx={{ width: 110, textAlign: 'right' }}>
                    {formatMoney(lineAmountCents(Number(line.quantity || 0), parseMoneyInput(line.rate)), currency)}
                  </Typography>
                  <IconButton aria-label="Remove line" disabled={busy}
                    onClick={() => setForm({ ...form, manualLines: form.manualLines.filter((_, i) => i !== idx) })}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              );
            })}
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>4. Dates, tax and notes</Typography>
            <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
              <TextField type="date" label="Issue date" InputLabelProps={{ shrink: true }}
                value={form.issueDate || defaults?.issueDate || ''} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} disabled={busy} />
              <TextField type="date" label="Due date" InputLabelProps={{ shrink: true }}
                value={form.dueDate || defaults?.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} disabled={busy} />
              <TextField label="Currency" value={currency} inputProps={{ maxLength: 3 }}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} sx={{ width: 110 }} disabled={busy} />
              <TextField label="Tax rate (%)" type="number" value={form.taxRate !== '' ? form.taxRate : String((defaults?.taxRateBp ?? 0) / 100)}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })} sx={{ width: 130 }} disabled={busy} inputProps={{ min: 0, max: 100, step: 0.01 }} />
            </Box>
            <TextField label="Notes / payment instructions" multiline rows={3} fullWidth value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={busy} />
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>5. Totals</Typography>
            <Box maxWidth={320} ml="auto">
              <Box display="flex" justifyContent="space-between"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></Box>
              <Box display="flex" justifyContent="space-between"><span>Tax ({taxRateBp / 100}%)</span><span>{formatMoney(tax, currency)}</span></Box>
              <Box display="flex" justifyContent="space-between" fontWeight="bold" mt={1}><span>Total</span><span>{formatMoney(subtotal + tax, currency)}</span></Box>
            </Box>
            {missingRate && <Alert severity="warning" sx={{ mt: 2 }}>Some lines have no rate. You can save a draft, but it can't be issued until every line has a rate.</Alert>}
          </Paper>
        </>
      )}

      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button onClick={() => navigate(isEdit ? `/invoices/${invoiceId}` : '/invoices')} disabled={busy}>Cancel</Button>
        <Button variant="outlined" disabled={!canSave} onClick={() => saveMutation.mutate(false)}>Save draft</Button>
        <Button variant="contained" disabled={!canSave || missingRate || lineTotals.length === 0} onClick={() => setConfirmIssue(true)}>
          Save and issue
        </Button>
      </Box>

      <Dialog open={confirmIssue} onClose={() => setConfirmIssue(false)}>
        <DialogTitle>Issue this invoice?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The invoice gets its number and can no longer be edited. To correct it later you will need to void it and create a new one.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmIssue(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(true)} disabled={busy}>
            {busy ? <CircularProgress size={24} /> : 'Issue invoice'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const InvoiceFormPage: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const invoiceId = id ? Number(id) : undefined;

  const { data: clientsData, isLoading: clientsLoading } = useQuery({ queryKey: ['clients'], queryFn: () => apiClient.getClients() });
  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => apiClient.getInvoice(invoiceId as number),
    enabled: invoiceId !== undefined,
  });

  if (clientsLoading || (invoiceId !== undefined && invoiceLoading)) {
    return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  }
  if (invoiceData && invoiceData.invoice.status !== 'draft') {
    return <Alert severity="info">Only draft invoices can be edited. Void this invoice and create a new one to make changes.</Alert>;
  }

  const initial = invoiceData
    ? initialFromInvoice(invoiceData.invoice)
    : { ...EMPTY_INITIAL, clientId: searchParams.get('clientId') || '' };

  return (
    <InvoiceForm
      key={invoiceId ?? 'new'}
      invoiceId={invoiceId}
      initial={initial}
      clients={clientsData?.clients || []}
    />
  );
};

export default InvoiceFormPage;
