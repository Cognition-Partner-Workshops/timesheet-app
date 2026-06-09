export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isWithinLength = (value: string, max: number): boolean =>
  value.length <= max;

export const isValidHoursPrecision = (hours: string): boolean =>
  /^\d+(\.\d{1,2})?$/.test(hours);
