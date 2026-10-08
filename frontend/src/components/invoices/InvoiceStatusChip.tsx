import React from 'react';
import { Chip } from '@mui/material';
import type { InvoiceStatus } from '../../types/api';

const COLORS: Record<InvoiceStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  issued: 'info',
  paid: 'success',
  void: 'default',
};

const InvoiceStatusChip: React.FC<{ status: InvoiceStatus; overdue?: boolean }> = ({ status, overdue }) => {
  if (overdue) return <Chip size="small" color="error" label="Overdue" />;
  return (
    <Chip
      size="small"
      color={COLORS[status]}
      variant={status === 'void' ? 'outlined' : 'filled'}
      label={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
};

export default InvoiceStatusChip;
