import { test, expect } from '@playwright/test';
import { TEST_EMAIL } from './helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('should login successfully with a valid email', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('not-an-email');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /failed|error|invalid/i })).toBeVisible({ timeout: 5000 });
  });

  test('should keep login button disabled when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
    await page.getByLabel('Email Address').fill('');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });
});
