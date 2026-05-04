import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CrudMutationOptions<TCreate, TUpdate> {
  queryKey: string;
  createFn: (data: TCreate) => Promise<unknown>;
  updateFn: (params: { id: number; data: TUpdate }) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
  deleteAllFn: () => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export function useCrudMutations<TCreate, TUpdate>({
  queryKey, createFn, updateFn, deleteFn, deleteAllFn, onSuccess, onError,
}: CrudMutationOptions<TCreate, TUpdate>) {
  const queryClient = useQueryClient();

  const handleError = (err: unknown, fallback: string) => {
    const typed = err as { response?: { data?: { error?: string } } };
    onError?.(typed.response?.data?.error || fallback);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => { invalidate(); onSuccess?.(); },
    onError: (err: unknown) => handleError(err, 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: TUpdate }) => updateFn(params),
    onSuccess: () => { invalidate(); onSuccess?.(); },
    onError: (err: unknown) => handleError(err, 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, 'Failed to delete'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllFn,
    onSuccess: invalidate,
    onError: (err: unknown) => handleError(err, 'Failed to delete all'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return { createMutation, updateMutation, deleteMutation, deleteAllMutation, isPending };
}
