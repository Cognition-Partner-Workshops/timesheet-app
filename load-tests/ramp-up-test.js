/**
 * Ramp-Up Test — 1 to 100 Users over 5 Minutes
 *
 * Gradually increases concurrency to observe how latency and error rate
 * scale with user count.  Useful for capacity planning.
 */

import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  login,
  createClient,
  createWorkEntry,
  getClients,
  getWorkEntries,
  getReport,
} from './helpers.js';

const errors = new Counter('custom_errors');
const workflowDuration = new Trend('workflow_duration');

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 75 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 100 }, // sustain peak
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const start = Date.now();
  const vuId = __VU;
  const iterId = __ITER;
  const email = `ramptest-vu${vuId}-${iterId}@example.com`;

  // Full workflow: login -> create client -> add entries -> read data -> report
  login(email);
  sleep(0.1);

  const clientId = createClient(email, `RampClient-${vuId}-${iterId}`);
  if (!clientId) {
    errors.add(1);
    return;
  }
  sleep(0.1);

  for (let i = 0; i < 2; i++) {
    createWorkEntry(email, clientId);
    sleep(0.05);
  }

  getClients(email);
  sleep(0.1);
  getWorkEntries(email, clientId);
  sleep(0.1);
  getReport(email, clientId);

  workflowDuration.add(Date.now() - start);
  sleep(0.3);
}
