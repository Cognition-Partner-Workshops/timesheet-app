import { isAxiosError } from 'axios';

/**
 * Extracts a user-facing message from an API error, falling back to the
 * provided default when the error carries no server-supplied message.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) {
    return err.response.data.error;
  }
  return fallback;
}
