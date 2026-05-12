import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /global-setup\.ts/,
    },
  ],
  webServer: [
    {
      command: 'cd backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'cd frontend && npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
