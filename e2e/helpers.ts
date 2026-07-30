import { Page, expect, request } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function resetDatabase() {
  const ctx = await request.newContext({ baseURL: 'http://localhost:3001' });
  await ctx.post('/api/test/reset');
  await ctx.dispose();
}

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

export async function login(page: Page, email = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  // Wait for dashboard to load - use heading instead of URL to be more resilient
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

export async function navigateTo(page: Page, item: 'Clients' | 'Work Entries' | 'Reports' | 'Dashboard') {
  await page.getByRole('button', { name: item }).first().click();
  await expect(page.getByRole('heading', { name: item })).toBeVisible({ timeout: 5000 });
}

export async function createClient(page: Page, name: string) {
  await navigateTo(page, 'Clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add New Client' })).toBeVisible({ timeout: 5000 });
  await dialog.getByLabel('Client Name').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
  // Wait for dialog to close indicating success
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 5000 });
}

export async function selectClientInDialog(page: Page, clientName: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();
}

export async function createWorkEntry(page: Page, clientName: string, hours: string, description: string) {
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  const dialog = page.getByRole('dialog');
  await selectClientInDialog(page, clientName);
  await dialog.getByLabel('Hours').fill(hours);
  await dialog.getByLabel('Description').fill(description);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}
