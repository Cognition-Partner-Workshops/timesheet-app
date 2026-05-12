import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with email field', async ({ page }) => {
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('should login successfully with a valid email', async ({ page }) => {
    await page.getByLabel('Email Address').fill('valid@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('not-an-email');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fail|error|invalid/i })).toBeVisible({ timeout: 5000 });
  });

  test('should keep login button disabled when email is empty', async ({ page }) => {
    const loginBtn = page.getByRole('button', { name: 'Log In' });
    await expect(loginBtn).toBeDisabled();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await page.getByLabel('Email Address').fill('redirect-test@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
