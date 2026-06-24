/**
 * Parses a UTC-midnight date value into a local-midnight Date object.
 *
 * Date-only values (whether stored as a UTC-midnight timestamp or an ISO string
 * like "YYYY-MM-DD") represent a calendar date, not a point in time.
 * Naively using `new Date(value)` interprets it as UTC midnight, which shifts
 * backwards for timezones west of UTC. This helper extracts the UTC date
 * components and constructs a local-midnight Date instead.
 */
export function parseLocalDate(dateValue: string | number): Date {
  const d = new Date(dateValue);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Formats a UTC-midnight date value for display without timezone shifting. */
export function formatDateString(dateValue: string | number): string {
  return parseLocalDate(dateValue).toLocaleDateString();
}
