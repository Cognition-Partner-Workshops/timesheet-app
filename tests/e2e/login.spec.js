// @ts-check
const { test, expect } = require('@playwright/test');

const TEST_EMAIL = 'e2e-test@example.com';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /time tracker/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });

  test('should disable login button when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.getByLabel(/email address/i).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});
