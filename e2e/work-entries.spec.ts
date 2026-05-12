import { test, expect } from '@playwright/test';

const uniqueEmail = () => `work-${Date.now()}@example.com`;

async function loginAndCreateClient(page: import('@playwright/test').Page, email: string, clientName: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(clientName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.goto('/work-entries');
  await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible();
}

test.describe('Work Entry Lifecycle', () => {
  test('should create a work entry for a client', async ({ page }) => {
    const email = uniqueEmail();
    await loginAndCreateClient(page, email, 'WE Create Client');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select client from dropdown
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'WE Create Client' }).click();

    await page.getByLabel('Hours').fill('4.5');
    await page.getByLabel('Description').fill('Frontend development work');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('WE Create Client')).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Frontend development work')).toBeVisible();
  });

  test('should edit hours on an existing work entry', async ({ page }) => {
    const email = uniqueEmail();
    await loginAndCreateClient(page, email, 'WE Edit Client');

    // Create an entry first
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'WE Edit Client' }).click();
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Initial entry');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('3 hours')).toBeVisible();

    // Edit the entry
    const row = page.getByRole('row').filter({ hasText: 'Initial entry' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('6');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('6 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).not.toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    const email = uniqueEmail();
    await loginAndCreateClient(page, email, 'WE Delete Client');

    // Create an entry first
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'WE Delete Client' }).click();
    await page.getByLabel('Hours').fill('2');
    await page.getByLabel('Description').fill('Entry to delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Entry to delete')).toBeVisible();

    // Handle confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('Entry to delete')).not.toBeVisible();
  });

  test('should show empty state when no entries exist', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(email);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Create a client so the work entries table is shown
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Empty State Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/work-entries');
    await expect(page.getByText(/no work entries found/i)).toBeVisible();
  });
});
