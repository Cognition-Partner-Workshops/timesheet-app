import { test, expect } from '@playwright/test';
import { login, uniqueEmail } from './helpers';

test.describe('Login flow', () => {
  test('valid credentials log the user in', async ({ page }) => {
    const email = uniqueEmail('login-ok');
    await login(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(email)).toBeVisible();
  });

  test('invalid credentials show an error and stay on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('not-an-email');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /Validation error|valid email|Login failed/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
  });

  test('unauthenticated visitors are redirected to login', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logout returns the user to the login page', async ({ page }) => {
    await login(page, uniqueEmail('logout'));
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
