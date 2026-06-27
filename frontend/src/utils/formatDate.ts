/**
 * Formats a YYYY-MM-DD date string as M/D/YYYY without timezone conversion.
 */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}
