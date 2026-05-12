import { test, expect } from '@playwright/test';
import { TEST_EMAIL, login } from '../fixtures/auth';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Page', () => {
  test('should display the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('should disable the login button when email is empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('should enable the login button when email is entered', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('user@example.com');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
  });

  test('should log in successfully and redirect to dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('should display user email in the header after login', async ({ page }) => {
    await login(page);
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });
});
