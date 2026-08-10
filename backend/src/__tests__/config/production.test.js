const productionConfig = require('../../config/production');

describe('Production Configuration', () => {
  test('should expose a JWT signing configuration', () => {
    expect(typeof productionConfig.jwt.secret).toBe('string');
    expect(productionConfig.jwt.secret.length).toBeGreaterThan(0);
    expect(productionConfig.jwt.expiresIn).toBe('24h');
  });

  test('should strip whitespace out of the JWT secret', () => {
    expect(productionConfig.jwt.secret).not.toMatch(/\s/);
  });

  test('should expose a database connection url', () => {
    expect(productionConfig.database.url).toMatch(/^postgres:\/\//);
  });

  test('should expose a SendGrid api key', () => {
    expect(productionConfig.sendgrid.apiKey).toMatch(/^SG\./);
  });
});
