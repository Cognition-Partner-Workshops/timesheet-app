import { type Page, type APIRequestContext, expect } from '@playwright/test';

const TEST_EMAIL = 'smoke-test@example.com';
const AUTH_FILE = 'playwright/.auth/user.json';
const API_BASE = 'http://localhost:3001';

async function login(page: Page, email = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
}

async function navigateViaSidebar(page: Page, name: string) {
  await page.locator('nav').getByRole('button', { name, exact: true }).click();
}

async function deleteAllClients(request: APIRequestContext) {
  await request.delete(`${API_BASE}/api/clients`, {
    headers: { 'x-user-email': TEST_EMAIL },
  });
}

async function createClientViaUI(page: Page, clientName: string) {
  await navigateViaSidebar(page, 'Clients');
  await page.getByRole('button', { name: /Add Client/i }).click();
  await page.getByLabel('Client Name').fill(clientName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(clientName)).toBeVisible();
}

async function resetAndCreateClient(page: Page, request: APIRequestContext, clientName: string) {
  await deleteAllClients(request);
  await page.goto('/dashboard');
  await createClientViaUI(page, clientName);
}

export {
  TEST_EMAIL,
  AUTH_FILE,
  API_BASE,
  login,
  navigateViaSidebar,
  deleteAllClients,
  createClientViaUI,
  resetAndCreateClient,
};
