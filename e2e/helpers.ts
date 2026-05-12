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
  await request.post(`${API_BASE}/api/auth/login`, {
    data: { email },
  });
  await request.delete(`${API_BASE}/api/clients`, {
    headers: { 'x-user-email': email },
  });
}

export async function createClient(
  page: Page,
  name: string,
  opts: { department?: string; email?: string; description?: string } = {}
) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByText('Add New Client')).toBeVisible();

  await page.getByLabel('Client Name').fill(name);
  if (opts.department) await page.getByLabel('Department').fill(opts.department);
  if (opts.email) await page.getByLabel('Email').fill(opts.email);
  if (opts.description) await page.getByLabel('Description').fill(opts.description);

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
  await expect(page.getByText(name)).toBeVisible();
}

export async function createWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  date: string,
  description?: string
) {
  await page.goto('/work-entries');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await expect(page.getByText('Add New Work Entry')).toBeVisible();

  // Select client from MUI Select dropdown (no proper label association)
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();

  // Fill hours
  await page.getByLabel('Hours').fill(hours);

  // Fill date using individual MUI DatePicker sections (MM/DD/YYYY)
  const [month, day, year] = date.split('/');
  await page.getByRole('dialog').getByLabel('Month').click();
  await page.getByRole('dialog').getByLabel('Month').fill(month);
  await page.getByRole('dialog').getByLabel('Day').fill(day);
  await page.getByRole('dialog').getByLabel('Year').fill(year);

  if (description) {
    await page.getByLabel('Description').fill(description);
  }

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
}
