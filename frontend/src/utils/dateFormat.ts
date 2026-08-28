/**
 * Converts a UTC-midnight date value into a local-midnight Date.
 *
 * Date-only values (UTC timestamps or ISO strings like "YYYY-MM-DD") represent
 * a calendar date. `new Date(value)` interprets them as UTC midnight, shifting
 * the date backwards for timezones west of UTC. This helper extracts UTC
 * components to build a local-midnight Date instead.
 */
export function toLocalDate(dateValue: string | number): Date {
  const d = new Date(dateValue);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
