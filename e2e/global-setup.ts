import { test as setup, expect } from '@playwright/test';
import { TEST_USER_EMAIL } from './helpers';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_USER_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
