import { test, expect } from '@playwright/test';
import { TEST_EMAIL } from './helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login page correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('should login with valid email and redirect to dashboard', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('not-an-email');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /fail|error|invalid/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('should disable login button when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('should show user email in header after login', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });
});
