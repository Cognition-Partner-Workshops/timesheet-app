/**
 * Breakpoint Test — Find the Concurrency Limit
 *
 * Ramps from 1 to 300 virtual users over 10 minutes.
 * The test aborts automatically when:
 *   - p(95) latency exceeds 2 seconds, OR
 *   - Error rate exceeds 10 %
 *
 * The VU count at the time of abort indicates the application's
 * approximate breaking point.
 */

import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  login,
  createClient,
  createWorkEntry,
  getClients,
  getReport,
} from './helpers.js';

const errors = new Counter('custom_errors');
const workflowDuration = new Trend('workflow_duration');

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export default function () {
  const start = Date.now();
  const vuId = __VU;
  const iterId = __ITER;
  const email = `breaktest-vu${vuId}-${iterId}@example.com`;

  login(email);
  sleep(0.1);

  const clientId = createClient(email, `BreakClient-${vuId}-${iterId}`);
  if (!clientId) {
    errors.add(1);
    return;
  }
  sleep(0.05);

  createWorkEntry(email, clientId);
  sleep(0.05);

  getClients(email);
  sleep(0.05);
  getReport(email, clientId);

  workflowDuration.add(Date.now() - start);
  sleep(0.2);
}
