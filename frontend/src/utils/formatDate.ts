/**
 * Formats a date value (ISO string or timestamp) as M/D/YYYY without timezone conversion.
 * This avoids the off-by-one bug where UTC midnight timestamps display as the previous day
 * in negative-offset timezones (Americas).
 */
export function formatDate(date: string | number): string {
  const isoDate = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
  const [year, month, day] = isoDate.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}
