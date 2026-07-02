/**
 * Scenario 1: Typical User Workflow
 * Simulates 50 concurrent users performing: login -> create client ->
 * create work entries -> view reports.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  BASE_URL, authHeaders, getUserEmail,
  randomInt, randomDate, randomDescription, randomClientName,
} from './config.js';

// Custom metrics
const loginDuration = new Trend('login_duration', true);
const createClientDuration = new Trend('create_client_duration', true);
const createEntryDuration = new Trend('create_entry_duration', true);
const viewReportDuration = new Trend('view_report_duration', true);
const listEntriesDuration = new Trend('list_entries_duration', true);
const errors = new Counter('business_errors');

export const options = {
  scenarios: {
    workflow: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    login_duration: ['p(95)<200'],
    create_client_duration: ['p(95)<300'],
    create_entry_duration: ['p(95)<300'],
    view_report_duration: ['p(95)<500'],
  },
};

export default function () {
  const email = getUserEmail(`${__VU}-${__ITER}`);
  const hdrs = authHeaders(email);
  let clientId;

  // 1. Login
  group('Login', () => {
    const res = http.post(`${BASE_URL}/api/auth/login`,
      JSON.stringify({ email }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(res.timings.duration);
    const ok = check(res, {
      'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
    if (!ok) errors.add(1);
  });

  sleep(0.3);

  // 2. Create a client
  group('Create Client', () => {
    const payload = JSON.stringify({
      name: randomClientName(`${__VU}-${__ITER}`),
      description: 'Load test client',
      department: 'Engineering',
      email: `client-${__VU}@example.com`,
    });
    const res = http.post(`${BASE_URL}/api/clients`, payload, { headers: hdrs });
    createClientDuration.add(res.timings.duration);
    const ok = check(res, {
      'client created 201': (r) => r.status === 201,
    });
    if (!ok) {
      errors.add(1);
      return;
    }
    const body = res.json();
    clientId = body.client && body.client.id;
  });

  if (!clientId) return;
  sleep(0.3);

  // 3. Create several work entries
  group('Create Work Entries', () => {
    for (let i = 0; i < 3; i++) {
      const payload = JSON.stringify({
        clientId,
        hours: randomInt(1, 8),
        description: randomDescription(),
        date: randomDate(),
      });
      const res = http.post(`${BASE_URL}/api/work-entries`, payload, { headers: hdrs });
      createEntryDuration.add(res.timings.duration);
      check(res, { 'entry created 201': (r) => r.status === 201 }) || errors.add(1);
      sleep(0.1);
    }
  });

  sleep(0.3);

  // 4. List work entries
  group('List Work Entries', () => {
    const res = http.get(`${BASE_URL}/api/work-entries`, { headers: hdrs });
    listEntriesDuration.add(res.timings.duration);
    check(res, { 'list entries 200': (r) => r.status === 200 }) || errors.add(1);
  });

  sleep(0.2);

  // 5. View report for the client
  group('View Client Report', () => {
    const res = http.get(`${BASE_URL}/api/reports/client/${clientId}`, { headers: hdrs });
    viewReportDuration.add(res.timings.duration);
    check(res, { 'report 200': (r) => r.status === 200 }) || errors.add(1);
  });

  sleep(0.5);
}
