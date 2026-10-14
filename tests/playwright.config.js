// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: { timeout: 10000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'cd ../backend && npm run dev',
      port: 3001,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../frontend && npm run dev',
      port: 5173,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
