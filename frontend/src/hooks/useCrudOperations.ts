import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CrudConfig<TCreate, TUpdate> {
  queryKey: string;
  createFn: (data: TCreate) => Promise<unknown>;
  updateFn: (id: number, data: TUpdate) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
}

export function useCrudOperations<TCreate, TUpdate>(config: CrudConfig<TCreate, TUpdate>) {
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] });

  const handleError = (err: unknown, fallbackMsg: string) => {
    const typed = err as { response?: { data?: { error?: string } } };
    setError(typed.response?.data?.error || fallbackMsg);
  };

  const createMutation = useMutation({
    mutationFn: (data: TCreate) => config.createFn(data),
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TUpdate }) => config.updateFn(id, data),
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => config.deleteFn(id),
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, 'Failed to delete'),
  });

  return {
    error,
    setError,
    createMutation,
    updateMutation,
    deleteMutation,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
