import { test, expect } from '@playwright/test';
import { login, navigateTo, createClient, selectClientInDialog, uniqueName, resetDatabase } from './helpers';

test.describe('Reporting', () => {
  let clientName: string;

  test.beforeAll(async () => { await resetDatabase(); });

  test.beforeEach(async ({ page }) => {
    clientName = uniqueName('Report Client');
    await login(page);
    await createClient(page, clientName);
    await navigateTo(page, 'Work Entries');

    // Entry 1: 5 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('5');
    await dialog.getByLabel('Description').fill('Report entry one');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Entry 2: 3 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('3');
    await dialog.getByLabel('Description').fill('Report entry two');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('should show correct totals in report', async ({ page }) => {
    await navigateTo(page, 'Reports');

    // Select the client from dropdown
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();

    // Verify report totals: 5 + 3 = 8 total hours, avg 4.00
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('4.00').first()).toBeVisible();

    // Verify individual entries appear in report table
    await expect(page.getByRole('cell', { name: 'Report entry one' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Report entry two' })).toBeVisible();
  });

  test('should show correct totals after adding more entries', async ({ page }) => {
    // Add another entry: 2 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await selectClientInDialog(page, clientName);
    await dialog.getByLabel('Hours').fill('2');
    await dialog.getByLabel('Description').fill('Report entry three');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await navigateTo(page, 'Reports');

    // Select client
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();

    // Verify: 5 + 3 + 2 = 10 total hours
    await expect(page.getByText('10.00').first()).toBeVisible({ timeout: 5000 });
  });
});
