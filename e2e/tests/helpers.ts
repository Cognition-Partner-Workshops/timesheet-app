import { Page, expect } from '@playwright/test';

let counter = 0;

/** Unique email per test so tests never share client/work-entry data. */
export function uniqueEmail(prefix = 'e2e'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

export function uniqueName(prefix = 'Client'): string {
  counter += 1;
  return `${prefix} ${Date.now()}-${counter}`;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export async function gotoSection(page: Page, name: 'Dashboard' | 'Clients' | 'Work Entries' | 'Reports'): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

export async function createClient(page: Page, name: string, fields: { department?: string; email?: string; description?: string } = {}): Promise<void> {
  await page.getByRole('button', { name: 'Add Client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Client Name').fill(name);
  if (fields.department) await dialog.getByLabel('Department').fill(fields.department);
  if (fields.email) await dialog.getByLabel('Email').fill(fields.email);
  if (fields.description) await dialog.getByLabel('Description').fill(fields.description);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
}

/**
 * Alerts rendered by the pages sit behind the MUI modal, which marks the rest of
 * the document aria-hidden, so they are matched by class rather than by role.
 */
export function alertText(page: Page) {
  return page.locator('.MuiAlert-root').last();
}

export function hoursInput(page: Page) {
  return page.getByRole('dialog').getByRole('spinbutton', { name: /Hours/ });
}

export async function selectClientInDialog(page: Page, clientName: string): Promise<void> {
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: clientName, exact: true }).click();
}

export async function createWorkEntry(page: Page, clientName: string, hours: string, description?: string): Promise<void> {
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  const dialog = page.getByRole('dialog');
  await selectClientInDialog(page, clientName);
  await hoursInput(page).fill(hours);
  if (description) await dialog.getByLabel('Description').fill(description);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
}

/** Accept the next window.confirm() dialog (used by delete actions). */
export function acceptNextConfirm(page: Page): void {
  page.once('dialog', (dialog) => dialog.accept());
}
