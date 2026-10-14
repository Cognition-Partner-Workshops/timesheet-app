/**
 * Scenario 2: Ramp-up Stress Test
 * Ramps from 1 to 100 virtual users over 5 minutes to find the breaking point.
 * Then holds at 100 VUs for 1 minute and ramps down.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  BASE_URL, authHeaders, getUserEmail,
  randomInt, randomDate, randomDescription, randomClientName,
} from './config.js';

const errors = new Counter('business_errors');
const workflowDuration = new Trend('full_workflow_duration', true);

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '1m', target: 40 },
    { duration: '1m', target: 60 },
    { duration: '1m', target: 80 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 100 }, // hold at peak
    { duration: '30s', target: 0 },  // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const email = getUserEmail(`${__VU}-${__ITER}`);
  const hdrs = authHeaders(email);
  const start = Date.now();
  let clientId;

  // Login
  {
    const res = http.post(`${BASE_URL}/api/auth/login`,
      JSON.stringify({ email }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!check(res, { 'login ok': (r) => r.status === 200 || r.status === 201 })) {
      errors.add(1);
    }
  }

  sleep(0.2);

  // Create client
  {
    const res = http.post(`${BASE_URL}/api/clients`,
      JSON.stringify({
        name: randomClientName(`${__VU}-${__ITER}`),
        description: 'Ramp-up test client',
        department: 'QA',
      }),
      { headers: hdrs },
    );
    if (check(res, { 'client ok': (r) => r.status === 201 })) {
      const body = res.json();
      clientId = body.client && body.client.id;
    } else {
      errors.add(1);
    }
  }

  if (!clientId) {
    workflowDuration.add(Date.now() - start);
    return;
  }

  sleep(0.2);

  // Create 2 work entries
  for (let i = 0; i < 2; i++) {
    const res = http.post(`${BASE_URL}/api/work-entries`,
      JSON.stringify({
        clientId,
        hours: randomInt(1, 8),
        description: randomDescription(),
        date: randomDate(),
      }),
      { headers: hdrs },
    );
    check(res, { 'entry ok': (r) => r.status === 201 }) || errors.add(1);
    sleep(0.1);
  }

  // List entries
  {
    const res = http.get(`${BASE_URL}/api/work-entries`, { headers: hdrs });
    check(res, { 'list ok': (r) => r.status === 200 }) || errors.add(1);
  }

  // View report
  {
    const res = http.get(`${BASE_URL}/api/reports/client/${clientId}`, { headers: hdrs });
    check(res, { 'report ok': (r) => r.status === 200 }) || errors.add(1);
  }

  workflowDuration.add(Date.now() - start);
  sleep(0.5);
}
