import { test, expect } from '@playwright/test';
import { login, clearAllClients, createClient, setupDialogHandler } from './helpers';

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    setupDialogHandler(page);
    await login(page);
    await clearAllClients(page);
  });

  test('should show correct totals after creating entries', async ({ page }) => {
    await createClient(page, 'Report Client');

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    // Entry 1: 5 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Report Client' }).click();
    await page.getByLabel('Hours').fill('5');
    await page.getByLabel('Description').fill('Task A');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Entry 2: 3.5 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Report Client' }).click();
    await page.getByLabel('Hours').fill('3.5');
    await page.getByLabel('Description').fill('Task B');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    // Navigate to reports
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Select the client — reports page also uses MUI Select
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Verify totals: 5 + 3.5 = 8.5 total hours, 2 entries
    await expect(page.getByText('8.50')).toBeVisible({ timeout: 10000 });

    // Verify individual entries appear in report table
    await expect(page.getByText('5 hours', { exact: true })).toBeVisible();
    await expect(page.getByText('3.5 hours', { exact: true })).toBeVisible();
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/You need to create at least one client/)).toBeVisible();
  });

  test('should show no entries message for client with no work', async ({ page }) => {
    await createClient(page, 'Empty Client');
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Empty Client' }).click();

    await expect(page.getByText('0.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No work entries found for this client/)).toBeVisible();
  });
});
