import { createWorkEntry, listClients, listWorkEntries, login, pause, randomClient, viewReport } from './lib.js';

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: __ENV.RAMP_PROFILE === 'short' ? [
        { duration: '15s', target: 25 },
        { duration: '15s', target: 50 },
        { duration: '15s', target: 75 },
        { duration: '15s', target: 100 },
        { duration: '15s', target: 100 },
      ] : [
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 75 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 100 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  login();
  return (listClients().json('clients') || []).map((client) => client.id);
}

export default function (clientIds) {
  login();
  const clientId = randomClient(clientIds);
  createWorkEntry(clientId);
  listWorkEntries(clientId);
  listClients();
  viewReport(clientId);
  pause(0.2);
}

export { handleSummary } from './summary.js';
