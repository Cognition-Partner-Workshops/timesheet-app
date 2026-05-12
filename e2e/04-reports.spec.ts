import { test, expect } from '@playwright/test';
import { login, resetBackend, apiCreateClient, apiCreateWorkEntry } from './helpers';

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    const data = await apiCreateClient('Report Client');
    const clientId = data.client.id;
    const today = new Date().toISOString().split('T')[0];
    await apiCreateWorkEntry(clientId, 5, 'Task A', today);
    await apiCreateWorkEntry(clientId, 3.5, 'Task B', today);
    await login(page);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('should display correct totals after selecting a client', async ({ page }) => {
    // Click the MUI Select dropdown
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Verify totals: 5 + 3.5 = 8.50 total hours, 2 entries, 4.25 avg
    await expect(page.getByText('8.50')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=4.25')).toBeVisible();

    // Verify entries appear in table
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
    await expect(page.getByText('5 hours', { exact: true })).toBeVisible();
    await expect(page.getByText('3.5 hours', { exact: true })).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await resetBackend();
    await page.reload();
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });

  test('should show no entries message for client without entries', async ({ page }) => {
    await apiCreateClient('Empty Client');
    await page.reload();

    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Empty Client' }).click();

    await expect(page.getByText('0.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No work entries found for this client')).toBeVisible();
  });
});
