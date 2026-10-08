import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type {
  CreateInvoiceRequest,
  InvoiceListFilters,
  InvoicePreviewParams,
  InvoiceStatus,
} from '../types/api';

export const useInvoices = (filters: InvoiceListFilters = {}) =>
  useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => apiClient.getInvoices(filters),
  });

export const useInvoice = (id: number | null) =>
  useQuery({
    queryKey: ['invoices', 'detail', id],
    queryFn: () => apiClient.getInvoice(id as number),
    enabled: id !== null,
  });

export const useInvoicePreview = (params: InvoicePreviewParams | null) =>
  useQuery({
    queryKey: ['invoices', 'preview', params],
    queryFn: () => apiClient.previewInvoice(params as InvoicePreviewParams),
    enabled: params !== null,
    retry: false,
  });

const useInvalidateBilling = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['workEntries'] });
  };
};

export const useCreateInvoice = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => apiClient.createInvoice(data),
    onSuccess: invalidate,
  });
};

export const useUpdateInvoiceStatus = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Exclude<InvoiceStatus, 'draft'> }) =>
      apiClient.updateInvoiceStatus(id, status),
    onSuccess: invalidate,
  });
};

export const useDeleteInvoice = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (id: number) => apiClient.deleteInvoice(id),
    onSuccess: invalidate,
  });
};
