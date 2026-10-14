const productionConfig = require('../../config/production');

describe('Production Configuration', () => {
  describe('jwt', () => {
    test('should expose a non-empty signing secret', () => {
      expect(typeof productionConfig.jwt.secret).toBe('string');
      expect(productionConfig.jwt.secret.length).toBeGreaterThan(0);
    });

    test('should not contain whitespace in the signing secret', () => {
      expect(productionConfig.jwt.secret).not.toMatch(/\s/);
    });

    test('should define a token expiry', () => {
      expect(productionConfig.jwt.expiresIn).toBe('24h');
    });
  });

  describe('database', () => {
    test('should expose a postgres connection url', () => {
      expect(productionConfig.database.url).toMatch(/^postgres:\/\//);
    });
  });

  describe('sendgrid', () => {
    test('should expose an api key', () => {
      expect(typeof productionConfig.sendgrid.apiKey).toBe('string');
      expect(productionConfig.sendgrid.apiKey.length).toBeGreaterThan(0);
    });
  });

  describe('module shape', () => {
    test('should expose exactly the expected sections', () => {
      expect(Object.keys(productionConfig).sort()).toEqual(['database', 'jwt', 'sendgrid']);
    });

    test('should return the same singleton object on re-require', () => {
      expect(require('../../config/production')).toBe(productionConfig);
    });
  });
});
