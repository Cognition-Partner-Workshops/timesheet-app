const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let _jwksCache = null;
let _jwksCacheTime = 0;
let _discoveryCache = null;
let _discoveryCacheTime = 0;
const CACHE_TTL = 300_000; // 5 minutes

function getOidcConfig() {
  const issuer = process.env.OIDC_ISSUER_URL;
  if (!issuer) return null;

  let url = issuer;
  while (url.endsWith('/')) url = url.slice(0, -1);

  return {
    issuerUrl: url,
    audience: process.env.OIDC_AUDIENCE || undefined,
    emailClaim: process.env.OIDC_EMAIL_CLAIM || 'email',
    allowedAlgorithms: (process.env.OIDC_ALLOWED_ALGORITHMS || 'RS256').split(',').map(s => s.trim()),
  };
}

async function fetchDiscovery(issuerUrl) {
  const now = Date.now();
  if (_discoveryCache && now - _discoveryCacheTime < CACHE_TTL) {
    return _discoveryCache;
  }

  const url = `${issuerUrl}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }
  _discoveryCache = await res.json();
  _discoveryCacheTime = now;
  return _discoveryCache;
}

async function fetchJwks(issuerUrl) {
  const now = Date.now();
  if (_jwksCache && now - _jwksCacheTime < CACHE_TTL) {
    return _jwksCache;
  }

  const discovery = await fetchDiscovery(issuerUrl);
  if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery response missing jwks_uri');
  }

  const jwksUrl = new URL(discovery.jwks_uri);
  const issuerOrigin = new URL(issuerUrl).origin;
  if (jwksUrl.origin !== issuerOrigin) {
    throw new Error(
      `JWKS URI origin (${jwksUrl.origin}) does not match issuer origin (${issuerOrigin})`
    );
  }

  const res = await fetch(jwksUrl.href);
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status} ${res.statusText}`);
  }
  const jwks = await res.json();
  _jwksCache = jwks;
  _jwksCacheTime = now;
  return jwks;
}

function jwkToPem(jwk) {
  const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return keyObject.export({ type: 'spki', format: 'pem' });
}

function findSigningKey(jwks, kid) {
  const keys = jwks.keys || [];
  const match = keys.find(
    (k) => k.kid === kid && (k.use === 'sig' || !k.use)
  );
  if (!match) {
    throw new Error(`No signing key found for kid: ${kid}`);
  }
  return jwkToPem(match);
}

async function verifyOidcToken(token) {
  const config = getOidcConfig();
  if (!config) {
    throw new Error('OIDC is not configured');
  }

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    throw new Error('Invalid JWT: unable to decode token');
  }

  const { kid } = decoded.header;
  if (!kid) {
    throw new Error('JWT missing kid header');
  }

  const jwks = await fetchJwks(config.issuerUrl);
  const signingKey = findSigningKey(jwks, kid);

  const verifyOptions = {
    issuer: config.issuerUrl,
    algorithms: config.allowedAlgorithms,
  };

  if (config.audience) {
    verifyOptions.audience = config.audience;
  }

  const payload = jwt.verify(token, signingKey, verifyOptions);

  const email = payload[config.emailClaim];
  if (!email || typeof email !== 'string') {
    throw new Error(`Token missing required claim: ${config.emailClaim}`);
  }

  return {
    email,
    subject: payload.sub || null,
    claims: payload,
  };
}

function isOidcEnabled() {
  return !!process.env.OIDC_ISSUER_URL;
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function resetCache() {
  _jwksCache = null;
  _jwksCacheTime = 0;
  _discoveryCache = null;
  _discoveryCacheTime = 0;
}

module.exports = {
  getOidcConfig,
  fetchDiscovery,
  fetchJwks,
  verifyOidcToken,
  isOidcEnabled,
  extractBearerToken,
  resetCache,
  jwkToPem,
  findSigningKey,
};
