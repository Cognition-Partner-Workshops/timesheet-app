import { type Page } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email: string = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 5000 });
}

export async function createClient(
  page: Page,
  name: string,
  options?: { description?: string; department?: string; email?: string }
) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  if (options?.department) {
    await page.getByLabel('Department').fill(options.department);
  }
  if (options?.email) {
    await page.getByLabel('Email').fill(options.email);
  }
  if (options?.description) {
    await page.getByLabel('Description').fill(options.description);
  }
  await page.getByRole('button', { name: /save|create/i }).click();
  await page.waitForTimeout(500);
}
