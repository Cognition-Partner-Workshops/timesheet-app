const morgan = require('morgan');
const { redactPII, sanitizeError, logError, anonymizeIp, registerPrivacyLogFormat } = require('../../utils/logger');

describe('logger PII protection', () => {
  test('redactPII masks email addresses', () => {
    expect(redactPII('user alice.smith@example.com failed')).toBe('user a***@example.com failed');
    expect(redactPII('no pii here')).toBe('no pii here');
    expect(redactPII(undefined)).toBeUndefined();
  });

  test('sanitizeError keeps only allow-listed fields', () => {
    const err = Object.assign(new Error('bad bob@corp.io'), {
      code: 'SQLITE_ERROR',
      _original: { email: 'bob@corp.io' },
      config: { headers: { 'x-user-email': 'bob@corp.io' } }
    });
    const safe = sanitizeError(err);
    expect(safe).toEqual({ name: 'Error', code: 'SQLITE_ERROR', message: 'bad b***@corp.io' });
    expect(sanitizeError('x@y.com')).toEqual({ message: 'x***@y.com' });
  });

  test('logError writes sanitized output only', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logError('Database error:', new Error('carol@site.org'));
    expect(spy).toHaveBeenCalledWith('Database error:', { name: 'Error', message: 'c***@site.org' });
    spy.mockRestore();
  });

  test('anonymizeIp truncates IPv4 and IPv6 addresses', () => {
    expect(anonymizeIp('203.0.113.42')).toBe('203.0.113.0');
    expect(anonymizeIp('::ffff:198.51.100.7')).toBe('198.51.100.0');
    expect(anonymizeIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    expect(anonymizeIp(undefined)).toBe('-');
  });

  test('privacy log format excludes referrer and user-agent', () => {
    const format = registerPrivacyLogFormat(morgan);
    expect(format).toContain(':anon-ip');
    expect(format).not.toMatch(/remote-addr|user-agent|referrer|remote-user/);
  });
});
