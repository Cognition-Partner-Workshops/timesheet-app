import { format, parseISO } from 'date-fns';

// Work entry dates are calendar days ('YYYY-MM-DD'). Parse/format them in local
// time; `new Date('YYYY-MM-DD')` and `toISOString()` use UTC and shift the day.
export const toCalendarDateString = (date: Date): string => format(date, 'yyyy-MM-dd');

export const parseCalendarDate = (value: string): Date => parseISO(value);

export const formatCalendarDate = (value: string): string =>
  parseCalendarDate(value).toLocaleDateString();
