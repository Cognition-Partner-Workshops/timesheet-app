/**
 * Baseline Load Test — 50 Concurrent Users
 *
 * Simulates 50 virtual users performing typical workflows:
 *   1. Login
 *   2. Create a client
 *   3. Create work entries
 *   4. List clients & work entries
 *   5. View report for the client
 *
 * Thresholds define the performance baselines:
 *   - p(95) response time < 500 ms
 *   - Error rate < 1 %
 *   - Throughput reported via iteration rate
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

// Custom metrics
const errors = new Counter('custom_errors');
const workflowDuration = new Trend('workflow_duration');

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    custom_errors: ['count<10'],
  },
};

export default function () {
  const start = Date.now();
  const vuId = __VU;
  const iterId = __ITER;
  const email = `loadtest-vu${vuId}-${iterId}@example.com`;

  // 1. Login
  login(email);
  sleep(0.1);

  // 2. Create a client
  const clientId = createClient(email, `TestClient-${vuId}-${iterId}`);
  if (!clientId) {
    errors.add(1);
    return;
  }
  sleep(0.1);

  // 3. Create a few work entries
  for (let i = 0; i < 3; i++) {
    createWorkEntry(email, clientId);
    sleep(0.05);
  }

  // 4. List clients & work entries
  getClients(email);
  sleep(0.1);
  getWorkEntries(email, clientId);
  sleep(0.1);

  // 5. View report
  getReport(email, clientId);

  workflowDuration.add(Date.now() - start);
  sleep(0.5);
}
