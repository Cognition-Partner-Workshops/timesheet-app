import { test, expect } from '@playwright/test';
import { login, navigateTo, createClient, createWorkEntry, uniqueName, resetDatabase } from './helpers';

test.describe('Reporting', () => {
  let clientName: string;

  test.beforeAll(async () => { await resetDatabase(); });

  test.beforeEach(async ({ page }) => {
    clientName = uniqueName('Report Client');
    await login(page);
    await createClient(page, clientName);
    await navigateTo(page, 'Work Entries');

    await createWorkEntry(page, clientName, '5', 'Report entry one');
    await createWorkEntry(page, clientName, '3', 'Report entry two');
  });

  test('should show correct totals in report', async ({ page }) => {
    await navigateTo(page, 'Reports');

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();

    // Verify report totals: 5 + 3 = 8 total hours, avg 4.00
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('4.00').first()).toBeVisible();

    await expect(page.getByRole('cell', { name: 'Report entry one' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Report entry two' })).toBeVisible();
  });

  test('should show correct totals after adding more entries', async ({ page }) => {
    await createWorkEntry(page, clientName, '2', 'Report entry three');

    await navigateTo(page, 'Reports');

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();

    // Verify: 5 + 3 + 2 = 10 total hours
    await expect(page.getByText('10.00').first()).toBeVisible({ timeout: 5000 });
  });
});
