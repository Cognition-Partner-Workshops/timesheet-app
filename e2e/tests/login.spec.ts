import { test, expect } from '@playwright/test';
import { uniqueEmail, login } from './helpers';

test.describe('Login flow', () => {
  test('valid credentials succeed', async ({ page }) => {
    const email = uniqueEmail('login-valid');
    await login(page, email);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('not-an-email');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /validation|email|failed/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login button disabled when email is empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });
});
