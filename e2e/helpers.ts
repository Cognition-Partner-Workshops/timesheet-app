import { Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email: string = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
}

export async function deleteAllClients(page: Page) {
  await navigateTo(page, '/clients');
  await page.waitForTimeout(500);
  const clearAllBtn = page.getByRole('button', { name: /clear all/i });
  if (await clearAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    page.once('dialog', dialog => dialog.accept());
    await clearAllBtn.click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('No clients found')).toBeVisible({ timeout: 5000 });
  }
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function createClient(page: Page, name: string, opts?: { department?: string; email?: string; description?: string }) {
  await navigateTo(page, '/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  if (opts?.department) await page.getByLabel('Department').fill(opts.department);
  if (opts?.email) await page.getByLabel('Email').fill(opts.email);
  if (opts?.description) await page.getByLabel('Description').fill(opts.description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 5000 });
}

export async function createWorkEntry(page: Page, clientName: string, hours: string, description: string) {
  await navigateTo(page, '/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.locator('.MuiSelect-select').click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(description)).toBeVisible({ timeout: 5000 });
}

export async function clickEditButton(page: Page) {
  await page.locator('td .MuiIconButton-colorPrimary').first().click();
}

export async function clickDeleteButton(page: Page) {
  page.on('dialog', dialog => dialog.accept());
  await page.locator('td .MuiIconButton-colorError').first().click();
}
