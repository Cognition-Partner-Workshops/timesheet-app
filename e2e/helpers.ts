import { type Page, type APIRequestContext, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const API_BASE = 'http://localhost:3001';

export { TEST_EMAIL, API_BASE };

export async function login(page: Page, email: string = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export async function apiClearAllClients(request: APIRequestContext, email: string = TEST_EMAIL) {
  await request.post(`${API_BASE}/api/auth/login`, { data: { email } });
  await request.delete(`${API_BASE}/api/clients`, { headers: { 'x-user-email': email } });
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function openAddClientDialog(page: Page) {
  await navigateTo(page, '/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByText('Add New Client')).toBeVisible();
}

export async function submitClientForm(page: Page, name: string, opts: { department?: string; email?: string; description?: string } = {}) {
  await page.getByLabel('Client Name').fill(name);
  if (opts.department) await page.getByLabel('Department').fill(opts.department);
  if (opts.email) await page.getByLabel('Email').fill(opts.email);
  if (opts.description) await page.getByLabel('Description').fill(opts.description);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}

export async function createClient(page: Page, name: string, opts: { department?: string; email?: string; description?: string } = {}) {
  await openAddClientDialog(page);
  await submitClientForm(page, name, opts);
  await expect(page.getByText(name)).toBeVisible();
}

export async function quickCreateClient(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}

export function fillDatePicker(page: Page, date: string) {
  const [month, day, year] = date.split('/');
  const dialog = page.getByRole('dialog');
  return (async () => {
    await dialog.getByLabel('Month').click();
    await dialog.getByLabel('Month').fill(month);
    await dialog.getByLabel('Day').fill(day);
    await dialog.getByLabel('Year').fill(year);
  })();
}

export async function createWorkEntry(page: Page, clientName: string, hours: string, date: string, description?: string) {
  await navigateTo(page, '/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await expect(page.getByText('Add New Work Entry')).toBeVisible();

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  await fillDatePicker(page, date);

  if (description) {
    await page.getByLabel('Description').fill(description);
  }

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}

export async function selectReportClient(page: Page, clientName: string) {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();
}

export async function deleteRowByText(page: Page, text: string) {
  page.once('dialog', (dialog) => dialog.accept());
  const row = page.getByRole('row').filter({ hasText: text });
  await row.getByRole('button').nth(1).click();
  await expect(page.getByText(text)).toBeHidden({ timeout: 5000 });
}

export async function editRowByText(page: Page, text: string) {
  const row = page.getByRole('row').filter({ hasText: text });
  await row.getByRole('button').first().click();
}
