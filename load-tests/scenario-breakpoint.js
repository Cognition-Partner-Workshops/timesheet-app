/**
 * Scenario 3: Breakpoint / Soak Test
 * Continuously increases load until the application starts failing.
 * Uses k6 ramping-arrival-rate to push request throughput up regardless of response time.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, authHeaders, getUserEmail,
  randomInt, randomDate, randomDescription, randomClientName,
} from './config.js';

const errors = new Counter('business_errors');
const failRate = new Rate('request_fail_rate');

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 300 },
        { duration: '30s', target: 400 },
        { duration: '30s', target: 500 },
      ],
    },
  },
  thresholds: {
    request_fail_rate: [{ threshold: 'rate<0.50', abortOnFail: true }],
  },
};

export default function () {
  const email = getUserEmail(`${__VU}-${__ITER}`);
  const hdrs = authHeaders(email);
  let clientId;

  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ email }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const loginOk = loginRes.status === 200 || loginRes.status === 201;
  failRate.add(!loginOk);
  if (!loginOk) { errors.add(1); return; }

  // Create client
  const clientRes = http.post(`${BASE_URL}/api/clients`,
    JSON.stringify({
      name: randomClientName(`${__VU}-${__ITER}`),
      description: 'Breakpoint test',
    }),
    { headers: hdrs },
  );
  const clientOk = clientRes.status === 201;
  failRate.add(!clientOk);
  if (!clientOk) { errors.add(1); return; }
  clientId = clientRes.json().client.id;

  // Create work entry
  const entryRes = http.post(`${BASE_URL}/api/work-entries`,
    JSON.stringify({
      clientId,
      hours: randomInt(1, 8),
      description: randomDescription(),
      date: randomDate(),
    }),
    { headers: hdrs },
  );
  failRate.add(entryRes.status !== 201);

  // View report
  const reportRes = http.get(`${BASE_URL}/api/reports/client/${clientId}`, { headers: hdrs });
  failRate.add(reportRes.status !== 200);
}
