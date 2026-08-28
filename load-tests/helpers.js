import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

/**
 * Login a virtual user by email and return the email for subsequent requests.
 * The app uses x-user-email header auth (no JWT needed for API calls).
 */
export function login(email) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );
  check(res, {
    'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
  return email;
}

/**
 * Return standard headers for an authenticated request.
 */
export function authHeaders(email) {
  return {
    'Content-Type': 'application/json',
    'x-user-email': email,
  };
}

/**
 * Create a client and return its id.
 */
export function createClient(email, name) {
  const payload = JSON.stringify({
    name: name || `Client-${Date.now()}`,
    description: 'Load test client',
    department: 'Engineering',
    email: `contact-${Date.now()}@example.com`,
  });

  const res = http.post(`${BASE_URL}/api/clients`, payload, {
    headers: authHeaders(email),
    tags: { name: 'create_client' },
  });
  check(res, {
    'create client 201': (r) => r.status === 201,
  });

  try {
    const body = res.json();
    return body.client ? body.client.id : null;
  } catch (_) {
    return null;
  }
}

/**
 * Create a work entry for a given client.
 */
export function createWorkEntry(email, clientId) {
  const payload = JSON.stringify({
    clientId: clientId,
    hours: ((Date.now() % 800) / 100) + 0.5,
    description: `Work entry from load test - ${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
  });

  const res = http.post(`${BASE_URL}/api/work-entries`, payload, {
    headers: authHeaders(email),
    tags: { name: 'create_work_entry' },
  });
  check(res, {
    'create work entry 201': (r) => r.status === 201,
  });
  return res;
}

/**
 * Get all clients for the user.
 */
export function getClients(email) {
  const res = http.get(`${BASE_URL}/api/clients`, {
    headers: authHeaders(email),
    tags: { name: 'get_clients' },
  });
  check(res, {
    'get clients 200': (r) => r.status === 200,
  });
  return res;
}

/**
 * Get all work entries (optionally filtered by clientId).
 */
export function getWorkEntries(email, clientId) {
  const url = clientId
    ? `${BASE_URL}/api/work-entries?clientId=${clientId}`
    : `${BASE_URL}/api/work-entries`;

  const res = http.get(url, {
    headers: authHeaders(email),
    tags: { name: 'get_work_entries' },
  });
  check(res, {
    'get work entries 200': (r) => r.status === 200,
  });
  return res;
}

/**
 * Get report for a client.
 */
export function getReport(email, clientId) {
  const res = http.get(`${BASE_URL}/api/reports/client/${clientId}`, {
    headers: authHeaders(email),
    tags: { name: 'get_report' },
  });
  check(res, {
    'get report 200': (r) => r.status === 200,
  });
  return res;
}
