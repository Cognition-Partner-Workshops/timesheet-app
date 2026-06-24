/**
 * Format a date string (YYYY-MM-DD) for display, avoiding timezone shifts.
 * Parses the date parts directly to prevent UTC-to-local conversion issues.
 */
export function formatDate(dateStr: string | number): string {
  if (typeof dateStr === 'number') {
    return new Date(dateStr).toLocaleDateString('en-US', { timeZone: 'UTC' });
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

/**
 * Parse a date string (YYYY-MM-DD) into a local Date object for date picker.
 * Avoids the off-by-one issue when parsing ISO date strings with new Date().
 */
export function parseDateString(dateStr: string | number): Date {
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
