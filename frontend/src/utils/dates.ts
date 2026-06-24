/**
 * Formats a date value for display without timezone conversion.
 *
 * Work-entry dates are stored as "YYYY-MM-DD" strings. Passing them
 * through `new Date()` creates UTC midnight, which `toLocaleDateString()`
 * renders as the *previous* day in timezones west of UTC.  This helper
 * parses the string directly so the displayed date always matches the
 * date the user originally entered.
 */
export function formatDate(dateValue: string | number): string {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-');
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
  }

  // Numeric timestamp (legacy) — use UTC accessors to avoid shift
  if (typeof dateValue === 'number') {
    const d = new Date(dateValue);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  }

  // Datetime string like "2026-06-24 07:15:18" — display the date part
  if (typeof dateValue === 'string' && dateValue.includes('-')) {
    const datePart = dateValue.split(/[T ]/)[0];
    const [year, month, day] = datePart.split('-');
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
  }

  return String(dateValue);
}
