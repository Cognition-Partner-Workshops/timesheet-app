import { check } from 'k6';
import http from 'k6/http';
import { createClient, createWorkEntry, login, USER_EMAIL } from './lib.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { http_req_failed: ['rate<0.01'] },
};

export function setup() {
  login();
  const clientIds = [];
  for (let i = 0; i < Number(__ENV.SEED_CLIENTS || 20); i += 1) {
    const response = createClient(`Heavy client ${i + 1}`);
    const client = response.json('client');
    if (client && client.id) clientIds.push(client.id);
  }
  const entriesPerClient = Number(__ENV.SEED_ENTRIES_PER_CLIENT || 150);
  for (const clientId of clientIds) {
    for (let i = 0; i < entriesPerClient; i += 1) {
      createWorkEntry(clientId, `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);
    }
  }
  return { clientIds, userEmail: USER_EMAIL };
}

export default function (data) {
  const response = http.get(`${__ENV.BASE_URL || 'http://127.0.0.1:3001'}/api/clients`, {
    headers: { 'x-user-email': data.userEmail },
    tags: { endpoint: 'seed_verify' },
  });
  check(response, { 'seed visible': (r) => r.status === 200 && r.json('clients').length >= data.clientIds.length });
}
