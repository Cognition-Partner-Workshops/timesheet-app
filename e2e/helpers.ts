import { Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email: string = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
}

export async function deleteAllClients(page: Page) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const clearAllBtn = page.getByRole('button', { name: /clear all/i });
  if (await clearAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    page.once('dialog', dialog => dialog.accept());
    await clearAllBtn.click();
    await page.waitForTimeout(1500);
    // Verify cleanup succeeded
    await expect(page.getByText('No clients found')).toBeVisible({ timeout: 5000 });
  }
}
