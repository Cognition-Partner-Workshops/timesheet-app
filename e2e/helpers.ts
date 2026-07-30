import { type Page, type APIRequestContext } from '@playwright/test';

export const TEST_USER_EMAIL = 'playwright-test@example.com';
export const API_URL = 'http://localhost:3001';

export async function login(page: Page, email: string = TEST_USER_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
}

export async function createClientViaAPI(
  request: APIRequestContext,
  name: string
): Promise<{ id: number; name: string }> {
  const response = await request.post(`${API_URL}/api/clients`, {
    headers: { 'x-user-email': TEST_USER_EMAIL },
    data: { name, department: '', email: '', description: '' },
  });
  const body = await response.json();
  return body.client;
}

export async function createWorkEntryViaAPI(
  request: APIRequestContext,
  entry: { clientId: number; hours: number; description: string; date?: string }
): Promise<{ id: number }> {
  const response = await request.post(`${API_URL}/api/work-entries`, {
    headers: { 'x-user-email': TEST_USER_EMAIL },
    data: {
      clientId: entry.clientId,
      hours: entry.hours,
      description: entry.description,
      date: entry.date || new Date().toISOString().split('T')[0],
    },
  });
  const body = await response.json();
  return body.workEntry;
}

export async function createClient(
  page: Page,
  client: { name: string; department?: string; email?: string; description?: string }
) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(client.name);
  if (client.department) {
    await page.getByLabel('Department').fill(client.department);
  }
  if (client.email) {
    await page.getByLabel('Email').fill(client.email);
  }
  if (client.description) {
    await page.getByLabel('Description').fill(client.description);
  }
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: client.name }).waitFor();
}

export function sidebarButton(page: Page, name: string) {
  return page.locator('nav').getByRole('button', { name, exact: true });
}
