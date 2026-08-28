import { randomUUID } from 'node:crypto';
import { expect, type Page, test as base } from '@playwright/test';

export const test = base.extend<{ userEmail: string; authedPage: Page }>({
  // eslint-disable-next-line no-empty-pattern
  userEmail: async ({}, use) => {
    await use(`e2e-${randomUUID()}@example.com`);
  },
  authedPage: async ({ page, userEmail }, use) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.addInitScript((email) => {
      localStorage.setItem('userEmail', email);
    }, userEmail);
    await use(page);
    expect(pageErrors, 'unexpected page errors').toEqual([]);
  },
});

export { expect };

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function createClient(
  page: Page,
  name: string,
  options: { department?: string; email?: string; description?: string } = {},
) {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(name);
  if (options.department) await page.getByLabel('Department').fill(options.department);
  if (options.email) await page.getByLabel('Email').fill(options.email);
  if (options.description) await page.getByLabel('Description').fill(options.description);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
}

export async function addWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  description = '',
) {
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.locator('[role="dialog"] [role="combobox"]').click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  if (description) await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const row = description
    ? page.getByRole('row').filter({ hasText: description })
    : page.getByRole('row').filter({ hasText: clientName }).last();
  await expect(row).toContainText(hours);
}
