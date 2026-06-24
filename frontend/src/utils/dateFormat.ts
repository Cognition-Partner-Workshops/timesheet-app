/**
 * Formats a date value for display without timezone shifting.
 *
 * Date-only values (whether stored as a UTC-midnight timestamp or an ISO string
 * like "YYYY-MM-DD") represent a calendar date, not a point in time.
 * Naively calling `new Date(value).toLocaleDateString()` converts UTC midnight
 * to local time, shifting the displayed date backwards for timezones west of UTC.
 *
 * This helper extracts the UTC year/month/day and constructs a local-midnight
 * Date so the displayed date always matches the stored calendar date.
 */
export function formatDateString(dateValue: string | number): string {
  const d = new Date(dateValue);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString();
}
