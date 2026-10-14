import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CrudConfig<TCreate, TUpdate> {
  queryKey: string;
  createFn: (data: TCreate) => Promise<unknown>;
  updateFn: (id: number, data: TUpdate) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function useCrudMutations<TCreate, TUpdate>(config: CrudConfig<TCreate, TUpdate>) {
  const queryClient = useQueryClient();

  const handleError = (err: unknown, fallback: string) => {
    const error = err as { response?: { data?: { error?: string } } };
    config.onError(error.response?.data?.error || fallback);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] });

  const createMutation = useMutation({
    mutationFn: config.createFn,
    onSuccess: () => { invalidate(); config.onSuccess(); },
    onError: (err: unknown) => handleError(err, `Failed to create ${config.queryKey.slice(0, -1)}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TUpdate }) => config.updateFn(id, data),
    onSuccess: () => { invalidate(); config.onSuccess(); },
    onError: (err: unknown) => handleError(err, `Failed to update ${config.queryKey.slice(0, -1)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: config.deleteFn,
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, `Failed to delete ${config.queryKey.slice(0, -1)}`),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return { createMutation, updateMutation, deleteMutation, isSaving };
}
