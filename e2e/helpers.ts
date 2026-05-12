import { type Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email: string = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 5000 });
}

export async function createClient(page: Page, name: string, options?: { department?: string; email?: string; description?: string }) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  if (options?.department) await page.getByLabel('Department').fill(options.department);
  if (options?.email) await page.getByLabel('Email').fill(options.email);
  if (options?.description) await page.getByLabel('Description').fill(options.description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}

export async function ensureClientExists(page: Page, name: string) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
  const tableText = await page.locator('table').textContent().catch(() => '');
  if (tableText?.includes('No clients found')) {
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill(name);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
  }
}

export async function openWorkEntryDialog(page: Page) {
  await page.goto('/work-entries');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
}

export async function createWorkEntry(page: Page, clientName: string, hours: string, description: string) {
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.locator('.MuiSelect-select').click();
  await page.getByRole('option').filter({ hasText: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}
