import { test, expect } from '@playwright/test';
import { login, deleteAllClients } from './helpers';

test.describe('Reporting', () => {
  test('should show correct totals in report after creating entries', async ({ page }) => {
    await login(page);
    await deleteAllClients(page);

    // Create a test client
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Report Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Report Client')).toBeVisible({ timeout: 5000 });

    // Create work entries with known hours
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    // Entry 1: 5 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Client' }).click();
    await page.getByLabel('Hours').fill('5');
    await page.getByLabel('Description').fill('Task A');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Task A')).toBeVisible({ timeout: 5000 });

    // Entry 2: 3 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Client' }).click();
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Task B');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Task B')).toBeVisible({ timeout: 5000 });

    // Navigate to reports
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Select the client from the MUI Select
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Wait for report to load
    await page.waitForTimeout(2000);

    // Verify the total hours (5 + 3 = 8)
    await expect(page.getByText('8.00')).toBeVisible({ timeout: 5000 });

    // Verify individual entries are shown
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
  });

  test('should show message when no clients exist', async ({ page }) => {
    await login(page);
    await deleteAllClients(page);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // When no clients exist, should show prompt to create one
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });
});
