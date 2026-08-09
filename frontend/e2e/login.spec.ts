import { expect, test, login } from './fixtures';

test('valid email logs in and lands on dashboard', async ({ page }) => {
  const email = `login-${Date.now()}@example.com`;
  await login(page, email);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('malformed email shows an error and remains on login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('not-an-email');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert').filter({ hasText: /valid email|validation/i })).toBeVisible();
});

test('empty email disables login and logout returns to login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  await login(page, `logout-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('protected route redirects unauthenticated users', async ({ page }) => {
  await page.goto('/clients');
  await expect(page).toHaveURL(/\/login$/);
});
