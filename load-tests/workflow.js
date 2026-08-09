import { check } from 'k6';
import { createWorkEntry, listClients, listWorkEntries, login, pause, randomClient, viewReport } from './lib.js';

export const options = {
  scenarios: {
    typical_workflow: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '3m',
    },
  },
  thresholds: {
    'http_req_duration{scenario:typical_workflow}': [{ threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  login();
  const response = listClients();
  const clients = response.json('clients') || [];
  check(response, { 'seed clients available': () => clients.length > 0 });
  return clients.map((client) => client.id);
}

export default function runWorkflow(clientIds) {
  login();
  const clientId = randomClient(clientIds);
  createWorkEntry(clientId);
  listWorkEntries(clientId);
  listClients();
  viewReport(clientId);
  pause(0.2);
}

export { handleSummary } from './summary.js';
