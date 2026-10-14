const { toDateOnly } = require('../../utils/date');

describe('toDateOnly', () => {
  test('should convert a Date to a YYYY-MM-DD string', () => {
    expect(toDateOnly(new Date('2024-01-05T00:00:00.000Z'))).toBe('2024-01-05');
  });

  test('should drop the time component of a Date', () => {
    expect(toDateOnly(new Date('2024-01-05T23:59:59.999Z'))).toBe('2024-01-05');
  });

  test('should pass through a string unchanged', () => {
    expect(toDateOnly('2024-01-05')).toBe('2024-01-05');
  });

  test('should pass through an epoch-millisecond number unchanged', () => {
    expect(toDateOnly(1786406400000)).toBe(1786406400000);
  });

  test('should truncate a Date based on UTC, not local time', () => {
    // 2024-01-05T23:30 in a +05:30 offset is still 2024-01-05 18:00 UTC,
    // so the UTC calendar date must be returned regardless of runner timezone.
    expect(toDateOnly(new Date('2024-01-05T23:30:00.000+05:30'))).toBe('2024-01-05');
  });

  test.each([
    ['null', null],
    ['undefined', undefined]
  ])('should pass through %s unchanged', (_label, value) => {
    expect(toDateOnly(value)).toBe(value);
  });
});
