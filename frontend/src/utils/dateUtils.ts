/**
 * Parses a date value from the API into a local-timezone Date at midnight.
 *
 * The backend stores dates via Joi's date() validator, which converts
 * ISO date strings to JS Date objects. SQLite then stores them as
 * numeric timestamps (UTC epoch millis). The API returns either:
 *   - A number like 1777507200000 (UTC midnight of the intended date)
 *   - A string like "2026-04-30"
 *
 * In both cases the value represents UTC midnight, so using
 * `new Date(value)` directly would show the previous day in any
 * timezone west of UTC. This function extracts the UTC date components
 * and builds a local-midnight Date instead.
 */
export function parseLocalDate(value: string | number): Date {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Formats a Date to a YYYY-MM-DD string using local-timezone values,
 * avoiding the UTC shift caused by `toISOString().split('T')[0]`.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
