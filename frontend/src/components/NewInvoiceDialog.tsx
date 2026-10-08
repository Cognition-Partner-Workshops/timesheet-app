import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { useCreateInvoice, useInvoicePreview } from '../hooks/useInvoices';
import type { Client, Invoice, InvoicePreviewParams } from '../types/api';
import { formatCurrency, getApiError, toIsoDate } from '../utils/billing';

interface NewInvoiceDialogProps {
  open: boolean;
  clients: Client[];
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}

const previousMonth = subMonths(new Date(), 1);

const NewInvoiceDialog: React.FC<NewInvoiceDialogProps> = ({ open, clients, onClose, onCreated }) => {
  const [clientId, setClientId] = useState<number>(0);
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(previousMonth));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(previousMonth));
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [exclusions, setExclusions] = useState<{ key: string; ids: number[] }>({ key: '', ids: [] });
  const [error, setError] = useState('');

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientHasRate = selectedClient?.hourly_rate !== null && selectedClient?.hourly_rate !== undefined;
  const periodValid = periodStart.getTime() <= periodEnd.getTime();

  const previewParams: InvoicePreviewParams | null = useMemo(
    () =>
      clientId && clientHasRate && periodValid
        ? { clientId, periodStart: toIsoDate(periodStart), periodEnd: toIsoDate(periodEnd) }
        : null,
    [clientId, clientHasRate, periodValid, periodStart, periodEnd]
  );
  const paramsKey = JSON.stringify(previewParams);

  const preview = useInvoicePreview(previewParams);
  const createInvoice = useCreateInvoice();

  const lineItems = preview.data?.lineItems ?? [];
  const excludedIds = exclusions.key === paramsKey ? exclusions.ids : [];
  const selectedItems = lineItems.filter((item) => !excludedIds.includes(item.work_entry_id));
  const selectedHours = Math.round(selectedItems.reduce((sum, item) => sum + item.hours, 0) * 100) / 100;
  const selectedTotal = Math.round(selectedItems.reduce((sum, item) => sum + item.amount * 100, 0)) / 100;
  const currency = preview.data?.currency ?? selectedClient?.currency ?? 'USD';

  const toggleEntry = (workEntryId: number) => {
    const ids = excludedIds.includes(workEntryId)
      ? excludedIds.filter((id) => id !== workEntryId)
      : [...excludedIds, workEntryId];
    setExclusions({ key: paramsKey, ids });
  };

  const handleCreate = () => {
    if (!previewParams || selectedItems.length === 0) return;
    setError('');
    createInvoice.mutate(
      {
        ...previewParams,
        dueDate: dueDate ? toIsoDate(dueDate) : undefined,
        notes: notes.trim() || undefined,
        workEntryIds: excludedIds.length > 0 ? selectedItems.map((item) => item.work_entry_id) : undefined,
      },
      {
        onSuccess: (data) => onCreated(data.invoice),
        onError: (err) => {
          const apiError = getApiError(err);
          if (apiError.status === 409) {
            setExclusions({ key: paramsKey, ids: [] });
            preview.refetch();
            setError('Some entries were billed on another invoice. The preview has been refreshed.');
          } else {
            setError(apiError.message || 'Failed to create invoice');
          }
        },
      }
    );
  };

  const previewError = preview.error ? getApiError(preview.error).message || 'Failed to load preview' : '';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>New Invoice</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth margin="dense" required>
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(Number(e.target.value))}
            >
              {clients.map((client) => (
                <MenuItem key={client.id} value={client.id} disabled={client.hourly_rate === null}>
                  {client.name}
                  {client.hourly_rate === null
                    ? ' (no hourly rate set)'
                    : ` (${formatCurrency(client.hourly_rate, client.currency)}/h)`}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Clients need an hourly rate (set on the Clients page) before they can be invoiced.</FormHelperText>
          </FormControl>

          <Box display="flex" gap={2} mt={1}>
            <DatePicker
              label="Period start"
              value={periodStart}
              onChange={(date) => date && setPeriodStart(date)}
              slotProps={{ textField: { fullWidth: true, margin: 'dense', required: true } }}
            />
            <DatePicker
              label="Period end"
              value={periodEnd}
              onChange={(date) => date && setPeriodEnd(date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: 'dense',
                  required: true,
                  error: !periodValid,
                  helperText: periodValid ? undefined : 'Period end must be on or after period start',
                },
              }}
            />
          </Box>

          <Box mt={2}>
            {!previewParams ? (
              <Typography color="text.secondary">Select a client and period to preview unbilled work entries.</Typography>
            ) : preview.isLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress />
              </Box>
            ) : previewError ? (
              <Alert severity="error">{previewError}</Alert>
            ) : lineItems.length === 0 ? (
              <Alert severity="info">No unbilled work entries in the selected period.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.work_entry_id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!excludedIds.includes(item.work_entry_id)}
                            onChange={() => toggleEntry(item.work_entry_id)}
                          />
                        </TableCell>
                        <TableCell>{item.entry_date}</TableCell>
                        <TableCell>{item.description || '-'}</TableCell>
                        <TableCell align="right">{item.hours}</TableCell>
                        <TableCell align="right">{formatCurrency(item.rate, currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography fontWeight="medium">
                          {selectedItems.length} of {lineItems.length} entries selected
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">{selectedHours}</Typography>
                      </TableCell>
                      <TableCell />
                      <TableCell align="right">
                        <Typography fontWeight="medium">{formatCurrency(selectedTotal, currency)}</Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          <Box display="flex" gap={2} mt={2}>
            <DatePicker
              label="Due date (optional)"
              value={dueDate}
              onChange={(date) => setDueDate(date)}
              slotProps={{ textField: { fullWidth: true, margin: 'dense' }, field: { clearable: true } }}
            />
          </Box>
          <TextField
            margin="dense"
            label="Notes"
            fullWidth
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            inputProps={{ maxLength: 1000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={createInvoice.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createInvoice.isPending || selectedItems.length === 0 || !previewParams}
          >
            {createInvoice.isPending ? <CircularProgress size={24} /> : 'Create Draft'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default NewInvoiceDialog;
