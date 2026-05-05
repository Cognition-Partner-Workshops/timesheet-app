/**
 * Parses a "YYYY-MM-DD" date string as a local-timezone Date.
 *
 * `new Date("2026-05-05")` is interpreted as UTC midnight by the
 * ECMAScript spec.  When that Date is later displayed with
 * `toLocaleDateString()` the browser converts it to the user's
 * local timezone, which can shift the visible date backward by a
 * day for anyone west of UTC.
 *
 * This helper splits the ISO string and constructs the Date with
 * year/month/day components so it always represents local midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object as "YYYY-MM-DD" using **local** date
 * components, avoiding the UTC shift that `toISOString().split('T')[0]`
 * introduces for users in UTC+ timezones.
 */
export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
