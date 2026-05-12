import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UseCrudOptions<T> {
  queryKey: string;
  createFn: (data: T) => Promise<unknown>;
  updateFn: (args: { id: number; data: Partial<T> }) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
  deleteAllFn: () => Promise<unknown>;
}

export function useCrudOperations<T>({ queryKey, createFn, updateFn, deleteFn, deleteAllFn }: UseCrudOptions<T>) {
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const onSuccess = () => { queryClient.invalidateQueries({ queryKey: [queryKey] }); };
  const onError = (err: unknown, fallbackMsg: string) => {
    const e = err as { response?: { data?: { error?: string } } };
    setError(e.response?.data?.error || fallbackMsg);
  };

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess,
    onError: (err: unknown) => onError(err, 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<T> }) => updateFn({ id, data }),
    onSuccess,
    onError: (err: unknown) => onError(err, 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess,
    onError: (err: unknown) => onError(err, 'Failed to delete'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllFn,
    onSuccess,
    onError: (err: unknown) => onError(err, 'Failed to delete all'),
  });

  return { createMutation, updateMutation, deleteMutation, deleteAllMutation, error, setError };
}
