import { test, expect } from '@playwright/test';
import { login, navigateTo, createClient, selectClientInDialog, uniqueName, resetDatabase } from './helpers';

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
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('4.5');
    await dialog.getByLabel('Description').fill('Implemented new feature');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Implemented new feature' })).toBeVisible();
  });

  test('should edit hours of an existing work entry', async ({ page }) => {
    // Create entry first
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('3');
    await dialog.getByLabel('Description').fill('Entry to edit');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Entry to edit' })).toBeVisible({ timeout: 5000 });

    // Click edit button (first icon button in row)
    const row = page.getByRole('row').filter({ hasText: 'Entry to edit' });
    await row.getByRole('button').first().click();

    // Update hours
    await expect(dialog.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();
    await dialog.getByLabel('Hours').clear();
    await dialog.getByLabel('Hours').fill('7');
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should delete a work entry', async ({ page }) => {
    // Create entry first
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('2');
    await dialog.getByLabel('Description').fill('Entry to delete');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'Entry to delete' })).toBeVisible({ timeout: 5000 });

    // Accept confirmation dialog
    page.on('dialog', d => d.accept());

    // Click delete button (second icon button in row)
    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByRole('cell', { name: 'Entry to delete' })).not.toBeVisible({ timeout: 5000 });
  });
});
