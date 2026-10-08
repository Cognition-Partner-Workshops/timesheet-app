import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { BillingProfile } from '../types/api';
import { apiErrorMessage } from '../utils/errors';

const BillingSettingsForm: React.FC<{ profile: BillingProfile }> = ({ profile }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessName: profile.business_name || '',
    address: profile.address || '',
    taxId: profile.tax_id || '',
    invoicePrefix: profile.invoice_prefix,
    defaultCurrency: profile.default_currency,
    defaultTaxRate: (profile.default_tax_rate_bp / 100).toString(),
    defaultPaymentTermsDays: String(profile.default_payment_terms_days),
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiClient.updateBillingProfile({
      businessName: form.businessName,
      address: form.address,
      taxId: form.taxId,
      invoicePrefix: form.invoicePrefix,
      defaultCurrency: form.defaultCurrency,
      defaultTaxRateBp: Math.round(Number(form.defaultTaxRate || 0) * 100),
      defaultPaymentTermsDays: Number(form.defaultPaymentTermsDays || 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingProfile'] });
      setMessage({ type: 'success', text: 'Billing settings saved' });
    },
    onError: (err) => setMessage({ type: 'error', text: apiErrorMessage(err, 'Failed to save billing settings') }),
  });

  const field = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      margin="dense"
      fullWidth
      label={label}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      disabled={mutation.isPending}
      {...extra}
    />
  );

  return (
    <Paper sx={{ p: 3, maxWidth: 640 }}>
      {message && <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Typography variant="h6" gutterBottom>Sender details (shown on invoices)</Typography>
        {field('businessName', 'Business name')}
        {field('address', 'Address', { multiline: true, rows: 3 })}
        {field('taxId', 'Tax ID / VAT number')}
        <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>Defaults</Typography>
        {field('invoicePrefix', 'Invoice number prefix', {
          helperText: `Next number: ${form.invoicePrefix || 'INV'}-${String(profile.next_invoice_seq).padStart(4, '0')}`,
        })}
        {field('defaultCurrency', 'Default currency (ISO code)', { inputProps: { maxLength: 3 } })}
        {field('defaultTaxRate', 'Default tax rate (%)', { type: 'number', inputProps: { min: 0, max: 100, step: 0.01 } })}
        {field('defaultPaymentTermsDays', 'Default payment terms (days)', { type: 'number', inputProps: { min: 0, max: 365 } })}
        <Box mt={2}>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

const BillingSettingsPage: React.FC = () => {
  const { data, isLoading } = useQuery({ queryKey: ['billingProfile'], queryFn: () => apiClient.getBillingProfile() });
  return (
    <Box>
      <Typography variant="h4" mb={3}>Billing settings</Typography>
      {isLoading || !data ? <CircularProgress /> : <BillingSettingsForm profile={data.billingProfile} />}
    </Box>
  );
};

export default BillingSettingsPage;
