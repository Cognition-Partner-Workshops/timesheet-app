const {
  getOidcConfig,
  isOidcEnabled,
  extractBearerToken,
  resetCache,
} = require('../../middleware/oidc');

describe('OIDC Middleware', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    resetCache();
    delete process.env.OIDC_ISSUER_URL;
    delete process.env.OIDC_AUDIENCE;
    delete process.env.OIDC_EMAIL_CLAIM;
    delete process.env.OIDC_ALLOWED_ALGORITHMS;
  });

  afterAll(() => {
    process.env = origEnv;
  });

  describe('isOidcEnabled', () => {
    test('returns false when OIDC_ISSUER_URL is not set', () => {
      expect(isOidcEnabled()).toBe(false);
    });

    test('returns true when OIDC_ISSUER_URL is set', () => {
      process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
      expect(isOidcEnabled()).toBe(true);
    });
  });

  describe('getOidcConfig', () => {
    test('returns null when OIDC_ISSUER_URL is not set', () => {
      expect(getOidcConfig()).toBeNull();
    });

    test('returns config with defaults when only issuer is set', () => {
      process.env.OIDC_ISSUER_URL = 'https://accounts.google.com/';
      const config = getOidcConfig();

      expect(config.issuerUrl).toBe('https://accounts.google.com');
      expect(config.audience).toBeUndefined();
      expect(config.emailClaim).toBe('email');
      expect(config.allowedAlgorithms).toEqual(['RS256']);
    });

    test('strips trailing slashes from issuer URL', () => {
      process.env.OIDC_ISSUER_URL = 'https://example.com///';
      expect(getOidcConfig().issuerUrl).toBe('https://example.com');
    });

    test('respects custom audience', () => {
      process.env.OIDC_ISSUER_URL = 'https://example.com';
      process.env.OIDC_AUDIENCE = 'my-client-id';
      expect(getOidcConfig().audience).toBe('my-client-id');
    });

    test('respects custom email claim', () => {
      process.env.OIDC_ISSUER_URL = 'https://example.com';
      process.env.OIDC_EMAIL_CLAIM = 'preferred_username';
      expect(getOidcConfig().emailClaim).toBe('preferred_username');
    });

    test('parses comma-separated algorithms', () => {
      process.env.OIDC_ISSUER_URL = 'https://example.com';
      process.env.OIDC_ALLOWED_ALGORITHMS = 'RS256, ES256, RS384';
      expect(getOidcConfig().allowedAlgorithms).toEqual(['RS256', 'ES256', 'RS384']);
    });
  });

  describe('extractBearerToken', () => {
    test('returns null when no authorization header', () => {
      const req = { headers: {} };
      expect(extractBearerToken(req)).toBeNull();
    });

    test('returns null when authorization header is not Bearer', () => {
      const req = { headers: { authorization: 'Basic abc123' } };
      expect(extractBearerToken(req)).toBeNull();
    });

    test('extracts token from Bearer header', () => {
      const req = { headers: { authorization: 'Bearer my-jwt-token' } };
      expect(extractBearerToken(req)).toBe('my-jwt-token');
    });

    test('returns null for empty Bearer value', () => {
      const req = { headers: { authorization: 'Bearer ' } };
      expect(extractBearerToken(req)).toBeNull();
    });
  });
});
