import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';
const USER_EMAIL = __ENV.USER_EMAIL || 'load-heavy@example.com';
let uniqueCounter = 0;

function uniqueId() {
  uniqueCounter += 1;
  return `${Date.now()}-${uniqueCounter}`;
}

export const endpointLatency = {
  login: new Trend('endpoint_login', true),
  createClient: new Trend('endpoint_create_client', true),
  listClients: new Trend('endpoint_list_clients', true),
  createEntry: new Trend('endpoint_create_entry', true),
  listEntries: new Trend('endpoint_list_entries', true),
  report: new Trend('endpoint_report', true),
};
export const endpointRequests = {
  login: new Counter('endpoint_login_requests'),
  createClient: new Counter('endpoint_create_client_requests'),
  listClients: new Counter('endpoint_list_clients_requests'),
  createEntry: new Counter('endpoint_create_entry_requests'),
  listEntries: new Counter('endpoint_list_entries_requests'),
  report: new Counter('endpoint_report_requests'),
};

function request(method, path, body, endpoint, extraParams = {}) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': USER_EMAIL,
    },
    tags: { endpoint },
    ...extraParams,
  };
  const response = http.request(method, `${BASE_URL}${path}`, body ? JSON.stringify(body) : null, params);
  endpointLatency[endpoint].add(response.timings.duration, { endpoint });
  endpointRequests[endpoint].add(1, { endpoint });
  return response;
}

export function login() {
  const response = request('POST', '/api/auth/login', { email: USER_EMAIL }, 'login');
  check(response, { 'login succeeded': (r) => r.status === 200 || r.status === 201 });
  return response;
}

export function createClient(name = `VU client ${uniqueId()}`) {
  const response = request('POST', '/api/clients', {
    name,
    description: 'Load-test client',
    department: 'Engineering',
    email: `load-${uniqueId()}@example.com`,
  }, 'createClient');
  check(response, { 'client created': (r) => r.status === 201 });
  return response;
}

export function listClients() {
  const response = request('GET', '/api/clients', null, 'listClients');
  check(response, { 'clients listed': (r) => r.status === 200 });
  return response;
}

export function createWorkEntry(clientId, date = new Date().toISOString().slice(0, 10)) {
  const response = request('POST', '/api/work-entries', {
    clientId,
    hours: 2.5,
    description: `Load-test work ${uniqueId()}`,
    date,
  }, 'createEntry');
  check(response, { 'work entry created': (r) => r.status === 201 });
  return response;
}

export function listWorkEntries(clientId) {
  const query = clientId ? `?clientId=${clientId}` : '';
  const response = request('GET', `/api/work-entries${query}`, null, 'listEntries');
  check(response, { 'work entries listed': (r) => r.status === 200 });
  return response;
}

export function viewReport(clientId) {
  const response = request('GET', `/api/reports/client/${clientId}`, null, 'report');
  check(response, { 'report viewed': (r) => r.status === 200 });
  return response;
}

export function runIteration(clientIds) {
  login();
  const clientId = randomClient(clientIds);
  createWorkEntry(clientId);
  listWorkEntries(clientId);
  listClients();
  viewReport(clientId);
  pause(0.2);
}

export function randomClient(clientIds) {
  return clientIds[(__VU + __ITER) % clientIds.length];
}

export function pause(seconds = 0.2) {
  sleep(seconds);
}

export { BASE_URL, USER_EMAIL };
