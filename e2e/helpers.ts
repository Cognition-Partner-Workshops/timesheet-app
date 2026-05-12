import { type Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2etest@example.com';
export const BASE_API = 'http://localhost:3001';

export async function login(page: Page, email = TEST_EMAIL) {
  // Clear any previous auth state so we always start fresh
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 });
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
    headers: { 'Content-Type': 'application/json', 'x-user-email': TEST_EMAIL },
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
    headers: { 'Content-Type': 'application/json', 'x-user-email': TEST_EMAIL },
    body: JSON.stringify({ clientId, hours, description, date: d }),
  });
  return res.json();
}
