import { listClients, login, runIteration } from './lib.js';

export const options = {
  scenarios: {
    breaking_point: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: getStages(),
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

function getStages() {
  if (__ENV.BREAKING_PROFILE === 'short') {
    return makeStages('10s', [25, 50, 75, 100, 125, 150, 175, 200]);
  }
  if (__ENV.BREAKING_PROFILE === 'extended') {
    return makeStages('15s', [25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
  }
  return [
    ...makeStages('30s', [25]),
    ...makeStages('45s', [50, 75, 100, 125, 150, 175, 200]),
  ];
}

function makeStages(duration, targets) {
  return targets.map((target) => ({ duration, target }));
}

export default function runBreaking(clientIds) {
  runIteration(clientIds);
}

export { handleSummary } from './summary.js';
