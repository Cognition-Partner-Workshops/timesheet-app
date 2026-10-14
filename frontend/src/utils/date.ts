/**
 * Parse a 'YYYY-MM-DD' string as **local** midnight.
 *
 * `new Date('2024-06-10')` is spec'd to parse as UTC midnight, which shifts
 * the visible day in any timezone west of UTC.  Appending 'T00:00:00' (no
 * trailing 'Z') forces the parse to use local time instead.
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T')) return new Date(dateStr);
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Format a Date to 'YYYY-MM-DD' using **local** date components.
 *
 * `date.toISOString().split('T')[0]` uses UTC components, which can shift
 * the date backward when local time is behind UTC.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
