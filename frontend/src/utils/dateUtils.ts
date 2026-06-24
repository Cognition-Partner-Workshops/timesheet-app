/**
 * Parse a date value (YYYY-MM-DD string or legacy timestamp) into a local Date,
 * avoiding the off-by-one timezone issue caused by new Date("YYYY-MM-DD").
 */
export function parseDateString(dateStr: string | number): Date {
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date value for display, avoiding timezone shifts.
 */
export function formatDate(dateStr: string | number): string {
  return parseDateString(dateStr).toLocaleDateString();
}
