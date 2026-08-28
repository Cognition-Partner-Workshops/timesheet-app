/**
 * Parse a date value from the API into a local-midnight Date object.
 *
 * The API may return dates as ISO strings ("2026-01-15") or as epoch
 * milliseconds (legacy data stored before the backend fix).  In both
 * cases we want to display the calendar date the user originally
 * entered, regardless of the browser's timezone.
 */
export function parseLocalDate(value: string | number): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // ISO date-only string → build a local-time Date so the calendar
    // day is preserved in every timezone.
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Epoch milliseconds (legacy) or full ISO-8601 string → extract the
  // UTC calendar date and reconstruct it at local midnight.
  const utc = new Date(value);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/**
 * Format a date value from the API for display (e.g. "1/15/2026").
 */
export function formatDate(value: string | number): string {
  return parseLocalDate(value).toLocaleDateString();
}
