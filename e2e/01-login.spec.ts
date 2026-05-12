import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login page', async ({ page }) => {
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('should login with valid email and redirect to dashboard', async ({ page }) => {
    await page.getByLabel('Email Address').fill('valid@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('not-a-valid-email');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /failed|error|invalid/i })).toBeVisible({ timeout: 5000 });
  });

  test('should keep login button disabled when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('should allow login with different valid emails', async ({ page }) => {
    await page.getByLabel('Email Address').fill('another-user@test.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
