import { type Page, type BrowserContext, expect } from '@playwright/test';

export const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email: string = TEST_EMAIL) {
  // Clear any previous auth state
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // If already logged in (unlikely with cleared cookies, but just in case)
  if (await page.getByRole('heading', { name: 'Dashboard' }).isVisible({ timeout: 500 }).catch(() => false)) {
    return;
  }

  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

export async function createClient(
  page: Page,
  name: string,
  opts: { description?: string; department?: string; email?: string } = {}
) {
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByText('Add New Client')).toBeVisible();
  await page.getByLabel('Client Name').fill(name);
  if (opts.department) {
    await page.getByLabel('Department').fill(opts.department);
  }
  if (opts.email) {
    await page.getByLabel('Email').fill(opts.email);
  }
  if (opts.description) {
    await page.getByLabel('Description').fill(opts.description);
  }
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Add New Client')).not.toBeVisible({ timeout: 10000 });
}

export async function ensureOnPage(page: Page, path: string) {
  if (!page.url().includes(path)) {
    await page.goto(path);
  }
  await page.waitForLoadState('networkidle');
}

export async function cleanupViaApi(page: Page) {
  // Use the API to delete all clients (cascades to work entries)
  await page.evaluate(async () => {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      await fetch('/api/clients', {
        method: 'DELETE',
        headers: { 'x-user-email': email },
      });
    } catch {
      // ignore
    }
  });
}
