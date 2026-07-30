import { type Page, expect } from '@playwright/test';

/**
 * Log in with the given email address.
 * The app uses email-only auth (no password).
 */
export async function login(page: Page, email = 'test@example.com') {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  // Wait for redirect to dashboard
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

/**
 * Create a client via the UI and return to the clients page.
 */
export async function createClient(
  page: Page,
  data: { name: string; department?: string; email?: string; description?: string },
) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel('Client Name').fill(data.name);
  if (data.department) await page.getByLabel('Department').fill(data.department);
  if (data.email) await page.getByLabel('Email').fill(data.email);
  if (data.description) await page.getByLabel('Description').fill(data.description);

  await page.getByRole('button', { name: 'Create' }).click();
  // Wait for dialog to close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
}

/**
 * Create a work entry via the UI.
 */
export async function createWorkEntry(
  page: Page,
  data: { clientName: string; hours: string; description?: string; date?: string },
) {
  await page.goto('/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Select client from MUI Select dropdown
  await page.getByLabel('Client').click();
  await page.getByRole('option', { name: data.clientName }).first().click();

  // Fill hours
  await page.getByLabel('Hours').fill(data.hours);

  // Fill description if provided
  if (data.description) {
    await page.getByLabel('Description').fill(data.description);
  }

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
}

/**
 * Delete all clients for the current user via the backend API.
 * This is more reliable than using the UI for test cleanup.
 */
export async function deleteAllClients(page: Page) {
  const email = await page.evaluate(() => localStorage.getItem('userEmail') || '');
  await page.request.delete('http://localhost:3001/api/clients', {
    headers: { 'x-user-email': email },
  });
}

/**
 * Delete all work entries for the current user via the backend API.
 */
export async function deleteAllWorkEntries(page: Page) {
  const email = await page.evaluate(() => localStorage.getItem('userEmail') || '');
  const response = await page.request.get('http://localhost:3001/api/work-entries', {
    headers: { 'x-user-email': email },
  });
  const data = await response.json();
  const entries = data.workEntries || [];
  for (const entry of entries) {
    await page.request.delete(`http://localhost:3001/api/work-entries/${entry.id}`, {
      headers: { 'x-user-email': email },
    });
  }
}
