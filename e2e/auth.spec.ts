import { test, expect } from '@playwright/test';
import { TEST_USER_EMAIL } from './helpers';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display the login page correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();

    // Login button should be disabled when email is empty
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();

    // Login button should be enabled when email is entered
    await page.getByLabel('Email Address').fill(TEST_USER_EMAIL);
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
  });

  test('should log in, show user email, and log out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_USER_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Should display user email in the header
    await expect(page.getByText(TEST_USER_EMAIL)).toBeVisible();

    // Should log out and redirect to login page
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });
});
