import { type Page, type APIRequestContext } from '@playwright/test';

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

export { TEST_EMAIL, AUTH_FILE, API_BASE, login, navigateViaSidebar, deleteAllClients };
