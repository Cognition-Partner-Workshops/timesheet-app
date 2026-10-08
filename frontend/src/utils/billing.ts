import { format } from 'date-fns';
import type { InvoiceStatus } from '../types/api';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CHF'];

export const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

export const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  issued: 'info',
  paid: 'success',
  void: 'error',
};

export interface ApiError {
  status?: number;
  message?: string;
}

export const getApiError = (err: unknown): ApiError => {
  const error = err as { response?: { status?: number; data?: { error?: string } } };
  return { status: error.response?.status, message: error.response?.data?.error };
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
