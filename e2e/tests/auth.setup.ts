import { test as setup, expect } from '@playwright/test';
import { TEST_EMAIL, AUTH_FILE } from '../fixtures/auth';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
