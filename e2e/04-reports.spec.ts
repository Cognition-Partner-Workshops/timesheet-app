import { test, expect } from '@playwright/test';
import { login, deleteAllClients, createClient, createWorkEntry, navigateTo } from './helpers';

test.describe('Reporting', () => {
  test('should show correct totals in report after creating entries', async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
    await createClient(page, 'Report Client');
    await createWorkEntry(page, 'Report Client', '5', 'Task A');
    await createWorkEntry(page, 'Report Client', '3', 'Task B');

    await navigateTo(page, '/reports');
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Client' }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByText('8.00')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
  });

  test('should show message when no clients exist', async ({ page }) => {
    await login(page);
    await deleteAllClients(page);

    await navigateTo(page, '/reports');
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });
});
