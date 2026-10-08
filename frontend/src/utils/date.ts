import { format, parseISO } from 'date-fns';

export const toDateOnlyString = (date: Date): string => format(date, 'yyyy-MM-dd');
export const parseDateOnly = (value: string): Date => parseISO(value);
export const formatDateOnly = (value: string): string => parseDateOnly(value).toLocaleDateString();
