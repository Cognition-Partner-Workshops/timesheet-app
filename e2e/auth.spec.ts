import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;

test.describe('Authentication Flow', () => {
  test('should display the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/auth-01-login-page.png' });
  });

  test('should register a new user and navigate to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill in the email and submit
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.screenshot({ path: 'e2e/screenshots/auth-02-email-filled.png' });

    await page.getByRole('button', { name: 'Log In' }).click();

    // Should navigate to the dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/auth-03-dashboard-loaded.png' });

    // Verify dashboard stats cards are visible
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Total Work Entries')).toBeVisible();
    await expect(page.getByText('Total Hours')).toBeVisible();
  });

  test('should log in with an existing user', async ({ page }) => {
    // First register the user
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });

    // Clear localStorage to simulate logout
    await page.evaluate(() => localStorage.removeItem('userEmail'));
    await page.goto('/login');

    // Log in again with same email
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    // Should land on dashboard again
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/auth-04-re-login-dashboard.png' });
  });

  test('should show login button disabled when email is empty', async ({ page }) => {
    await page.goto('/login');
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await expect(loginButton).toBeDisabled();
    await page.screenshot({ path: 'e2e/screenshots/auth-05-login-disabled.png' });
  });
});
