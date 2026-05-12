import { expect, type Page } from '@playwright/test';

let emailCounter = 0;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${emailCounter++}@example.com`;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createClient(page: Page, name: string): Promise<void> {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
}

export async function createWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  description: string,
): Promise<void> {
  await page.goto('/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.getByRole('combobox', { name: 'Client' }).click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

export async function openClientDialog(page: Page): Promise<void> {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
}

export async function openWorkEntryDialog(page: Page, clientName: string): Promise<void> {
  await page.goto('/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.getByRole('combobox', { name: 'Client' }).click();
  await page.getByRole('option', { name: clientName }).click();
}

export async function clickEditButton(page: Page, rowText: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: rowText });
  await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function clickDeleteButton(page: Page, rowText: string): Promise<void> {
  page.on('dialog', (dialog) => dialog.accept());
  const row = page.getByRole('row').filter({ hasText: rowText });
  await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();
}
