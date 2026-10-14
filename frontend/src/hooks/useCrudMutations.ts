import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CrudConfig<TCreate, TUpdate> {
  queryKey: string;
  createFn: (data: TCreate) => Promise<unknown>;
  updateFn: (id: number, data: TUpdate) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export function useCrudMutations<TCreate, TUpdate>(config: CrudConfig<TCreate, TUpdate>) {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] });

  const extractError = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { error?: string } } };
    return e.response?.data?.error || fallback;
  };

  const createMutation = useMutation({
    mutationFn: (data: TCreate) => config.createFn(data),
    onSuccess: () => { invalidate(); config.onSuccess?.(); },
    onError: (err: unknown) => config.onError?.(extractError(err, 'Failed to create')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TUpdate }) => config.updateFn(id, data),
    onSuccess: () => { invalidate(); config.onSuccess?.(); },
    onError: (err: unknown) => config.onError?.(extractError(err, 'Failed to update')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => config.deleteFn(id),
    onSuccess: invalidate,
    onError: (err: unknown) => config.onError?.(extractError(err, 'Failed to delete')),
  });

  return { createMutation, updateMutation, deleteMutation };
}
