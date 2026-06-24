export function extractApiError(err: unknown, fallback: string): string {
  const typed = err as { response?: { data?: { error?: string } } };
  return typed.response?.data?.error || fallback;
}
