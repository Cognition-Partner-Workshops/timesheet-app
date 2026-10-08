export function apiErrorMessage(err: unknown, fallback: string): string {
  const error = err as { response?: { data?: { error?: string; details?: string[] } } };
  const data = error.response?.data;
  if (data?.details?.length) return data.details.join(', ');
  return data?.error || fallback;
}
