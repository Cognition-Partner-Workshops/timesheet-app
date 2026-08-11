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

  test.each([
    ['null', null],
    ['undefined', undefined]
  ])('should pass through %s unchanged', (_label, value) => {
    expect(toDateOnly(value)).toBe(value);
  });
});
