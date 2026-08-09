import { createWorkEntry, listClients, listWorkEntries, login, pause, randomClient, viewReport } from './lib.js';

export const options = {
  scenarios: {
    breaking_point: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: __ENV.BREAKING_PROFILE === 'short' ? [
        { duration: '10s', target: 25 },
        { duration: '10s', target: 50 },
        { duration: '10s', target: 75 },
        { duration: '10s', target: 100 },
        { duration: '10s', target: 125 },
        { duration: '10s', target: 150 },
        { duration: '10s', target: 175 },
        { duration: '10s', target: 200 },
      ] : [
        { duration: '30s', target: 25 },
        { duration: '45s', target: 50 },
        { duration: '45s', target: 75 },
        { duration: '45s', target: 100 },
        { duration: '45s', target: 125 },
        { duration: '45s', target: 150 },
        { duration: '45s', target: 175 },
        { duration: '45s', target: 200 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '20s' }],
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
