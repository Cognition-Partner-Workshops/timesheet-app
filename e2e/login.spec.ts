import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login page with correct elements', async ({ page }) => {
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('should disable login button when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('should enable login button when email is entered', async ({ page }) => {
    await page.getByLabel('Email Address').fill('user@example.com');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
  });

  test('should log in successfully and redirect to dashboard', async ({ page }) => {
    await page.getByLabel('Email Address').fill('e2etest@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();

    // Should be redirected to the dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // User email should appear in the header
    await expect(page.getByText('e2etest@example.com')).toBeVisible();
  });

  test('should show navigation sidebar after login', async ({ page }) => {
    await page.getByLabel('Email Address').fill('e2etest@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Sidebar nav items should be visible
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Work Entries' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reports', exact: true }).first()).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any stored auth
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should log out successfully', async ({ page }) => {
    // Log in first
    await page.getByLabel('Email Address').fill('e2etest@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Click logout
    await page.getByRole('button', { name: 'Logout' }).click();
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
