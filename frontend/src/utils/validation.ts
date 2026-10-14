export const isValidEmail = (email: string): boolean => {
  if (email.length > 320) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (/\s/.test(local) || /\s/.test(domain)) return false;
  return domain.includes('.');
};

export const isWithinLength = (value: string, max: number): boolean =>
  value.length <= max;

export const isValidHoursPrecision = (hours: string): boolean =>
  /^\d+(\.\d{1,2})?$/.test(hours);
