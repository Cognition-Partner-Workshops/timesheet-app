export function formatMoney(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

// Mirrors backend/src/services/invoices.js so previews match the saved totals.
export function lineAmountCents(quantity: number, unitPriceCents: number | null): number {
  if (unitPriceCents === null) return 0;
  return Math.floor((Math.round(quantity * 100) * unitPriceCents + 50) / 100);
}

export function taxCents(subtotalCents: number, taxRateBp: number): number {
  return Math.floor((subtotalCents * taxRateBp + 5000) / 10000);
}
