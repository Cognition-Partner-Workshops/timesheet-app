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
  // Numeric timestamp (legacy) — use UTC accessors to avoid shift
  if (typeof dateValue === 'number') {
    const d = new Date(dateValue);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  }

  // String containing a date ("YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS")
  if (typeof dateValue === 'string' && dateValue.includes('-')) {
    const [year, month, day] = dateValue.split(/[T ]/)[0].split('-');
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
  }

  return String(dateValue);
}
