/**
 * Timezone-safe date helpers.
 *
 * `new Date("YYYY-MM-DD")` is parsed as UTC midnight per ECMAScript spec,
 * causing off-by-one display errors for users west of UTC and submission
 * errors for users east of UTC. These helpers use local date components
 * to avoid both problems.
 */

/** Parse "YYYY-MM-DD" as local midnight instead of UTC midnight. */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a Date as "YYYY-MM-DD" using local components (not UTC). */
export function formatDateForApi(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a "YYYY-MM-DD" string and return a locale-formatted display string. */
export function displayLocalDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString();
}
