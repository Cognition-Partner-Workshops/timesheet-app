import { Page, expect } from '@playwright/test';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createClient(
  page: Page,
  name: string,
  opts: { department?: string; email?: string; description?: string } = {}
): Promise<void> {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Client Name').fill(name);
  if (opts.department) await dialog.getByLabel('Department').fill(opts.department);
  if (opts.email) await dialog.getByLabel('Email').fill(opts.email);
  if (opts.description) await dialog.getByLabel('Description').fill(opts.description);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
}

export async function createWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  description?: string
): Promise<void> {
  await page.goto('/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Client').click();
  await page.getByRole('option', { name: clientName }).click();
  await dialog.getByLabel('Hours').fill(hours);
  if (description) await dialog.getByLabel('Description').fill(description);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
}
