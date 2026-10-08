const DAY_MS = 24 * 60 * 60 * 1000;

function toCents(amount) {
  if (amount === null || amount === undefined) return null;
  return Math.round(Number(amount) * 100);
}

function fromCents(cents) {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

function toHundredths(hours) {
  return Math.round(Number(hours) * 100);
}

// Integer arithmetic so the result is exact: round(hours * rate), half away from zero.
function lineAmountCents(hours, rateCents) {
  return Math.floor((toHundredths(hours) * rateCents + 50) / 100);
}

// Work entry dates are stored as epoch milliseconds (Joi converts ISO strings to Date objects).
function toIsoDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatMoney(cents, currency) {
  const amount = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${amount} ${currency}`;
}

module.exports = {
  DAY_MS,
  toCents,
  fromCents,
  toHundredths,
  lineAmountCents,
  toIsoDate,
  formatMoney
};
