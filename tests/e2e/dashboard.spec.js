// @ts-check
const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/e2e-login');

const TEST_EMAIL = 'e2e-dashboard@example.com';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_EMAIL);
  });

  test('should display dashboard with stats cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/total clients/i)).toBeVisible();
    await expect(page.getByText(/total work entries/i)).toBeVisible();
    await expect(page.getByText(/total hours/i)).toBeVisible();
  });

  test('should display quick actions', async ({ page }) => {
    await expect(page.getByText(/quick actions/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add client/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add work entry/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /view reports/i })).toBeVisible();
  });

  test('should navigate to clients page via sidebar', async ({ page }) => {
    await page.locator('nav').getByText('Clients').click();
    await expect(page).toHaveURL(/clients/);
  });

  test('should navigate to work entries page via sidebar', async ({ page }) => {
    await page.locator('nav').getByText('Work Entries').click();
    await expect(page).toHaveURL(/work-entries/);
  });

  test('should navigate to reports page via sidebar', async ({ page }) => {
    await page.locator('nav').getByText('Reports').click();
    await expect(page).toHaveURL(/reports/);
  });
});
