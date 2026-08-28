import { type Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2etest@example.com';
export const BASE_API = 'http://localhost:3001';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'x-user-email': TEST_EMAIL,
};

export async function login(page: Page, email = TEST_EMAIL) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 });
}

export async function loginAndNavigate(page: Page, path: string, heading: string) {
  await resetBackend();
  await login(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

export async function resetBackend() {
  await fetch(`${BASE_API}/api/clients`, {
    method: 'DELETE',
    headers: { 'x-user-email': TEST_EMAIL },
  });
}

export async function apiCreateClient(name: string, opts: Record<string, string> = {}) {
  const res = await fetch(`${BASE_API}/api/clients`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ name, ...opts }),
  });
  return res.json();
}

export async function apiCreateWorkEntry(
  clientId: number,
  hours: number,
  description: string,
  date?: string
) {
  const d = date || new Date().toISOString().split('T')[0];
  const res = await fetch(`${BASE_API}/api/work-entries`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ clientId, hours, description, date: d }),
  });
  return res.json();
}

export async function selectMuiOption(page: Page, optionName: string, scope = '.MuiDialog-root') {
  await page.locator(`${scope} .MuiSelect-select`).click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function openDialogAndFillForm(
  page: Page,
  buttonName: string,
  dialogTitle: string,
  fields: Record<string, string>
) {
  await page.getByRole('button', { name: buttonName }).click();
  await expect(page.getByText(dialogTitle)).toBeVisible();
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value);
  }
}

export async function clickRowAction(page: Page, rowText: string, iconTestId: string) {
  const row = page.getByRole('row').filter({ hasText: rowText });
  await row.locator(`[data-testid="${iconTestId}"]`).click();
}
