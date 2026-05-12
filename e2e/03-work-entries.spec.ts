import { test, expect } from '@playwright/test';
import { login, navigateTo, createClient, createWorkEntry, selectClientInDialog, uniqueName, resetDatabase } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  let clientName: string;

  test.beforeAll(async () => { await resetDatabase(); });

  test.beforeEach(async ({ page }) => {
    clientName = uniqueName('WE Client');
    await login(page);
    await createClient(page, clientName);
    await navigateTo(page, 'Work Entries');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await createWorkEntry(page, clientName, '4.5', 'Implemented new feature');
    await expect(page.getByRole('cell', { name: 'Implemented new feature' })).toBeVisible();
  });

  test('should edit hours of an existing work entry', async ({ page }) => {
    await createWorkEntry(page, clientName, '3', 'Entry to edit');
    await expect(page.getByRole('cell', { name: 'Entry to edit' })).toBeVisible({ timeout: 5000 });

    const row = page.getByRole('row').filter({ hasText: 'Entry to edit' });
    await row.getByRole('button').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();
    await dialog.getByLabel('Hours').clear();
    await dialog.getByLabel('Hours').fill('7');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should delete a work entry', async ({ page }) => {
    await createWorkEntry(page, clientName, '2', 'Entry to delete');
    await expect(page.getByRole('cell', { name: 'Entry to delete' })).toBeVisible({ timeout: 5000 });

    page.on('dialog', d => d.accept());

    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByRole('cell', { name: 'Entry to delete' })).not.toBeVisible({ timeout: 5000 });
  });
});
