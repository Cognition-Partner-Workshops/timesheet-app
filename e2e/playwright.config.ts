import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    timezoneId: process.env.E2E_TIMEZONE ?? 'UTC',
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo: Number(process.env.E2E_SLOW_MO ?? 0) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_START_SERVERS
    ? [
        { command: 'npm run dev', cwd: '../backend', url: 'http://localhost:3001/health', reuseExistingServer: true },
        { command: 'npm run dev', cwd: '../frontend', url: baseURL, reuseExistingServer: true },
      ]
    : undefined,
});
