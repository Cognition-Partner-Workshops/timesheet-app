// Shared configuration for k6 load tests
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Thresholds used across all test scenarios
export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.05'],
  http_reqs: ['rate>10'],
};

// Generate a unique user email for a given VU
export function getUserEmail(vuId) {
  return `loadtest-user-${vuId}@k6test.local`;
}

// Standard headers for authenticated requests
export function authHeaders(email) {
  return {
    'Content-Type': 'application/json',
    'x-user-email': email,
  };
}

// Random helpers
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDate() {
  const start = new Date('2024-01-01');
  const end = new Date('2025-12-31');
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

export function randomDescription() {
  const tasks = [
    'Backend API development',
    'Frontend UI implementation',
    'Code review and testing',
    'Database optimization',
    'Documentation writing',
    'Sprint planning meeting',
    'Bug fix and deployment',
    'Performance tuning',
    'Client consultation call',
    'Architecture design session',
  ];
  return tasks[Math.floor(Math.random() * tasks.length)];
}

export function randomClientName(suffix) {
  const names = [
    'Acme Corp', 'TechStart Inc', 'DataFlow Ltd', 'CloudNine Solutions',
    'ByteForce', 'NetPeak Systems', 'CodeCraft LLC', 'PixelPerfect Design',
    'ServerStack', 'AppWave Digital',
  ];
  return `${names[Math.floor(Math.random() * names.length)]} ${suffix}`;
}
