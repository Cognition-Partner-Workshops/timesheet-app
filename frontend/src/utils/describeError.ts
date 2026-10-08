// Axios errors carry request headers (x-user-email) and bodies; log only non-PII fields.
export const describeError = (error: unknown): string => {
  const err = error as { response?: { status?: number }; message?: string } | null;
  if (err?.response?.status) {
    return `HTTP ${err.response.status}`;
  }
  return err?.message ? 'Request failed' : 'Unknown error';
};
