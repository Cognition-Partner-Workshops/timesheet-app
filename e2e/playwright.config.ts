import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.E2E_API_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : [
        {
          command: 'npm start',
          cwd: '../backend',
          url: `${BACKEND_URL}/health`,
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            PORT: '3001',
            NODE_ENV: 'development',
            FRONTEND_URL,
            RATE_LIMIT_MAX: '100000',
          },
        },
        {
          command: 'npm run dev -- --port 5173 --strictPort',
          cwd: '../frontend',
          url: FRONTEND_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
