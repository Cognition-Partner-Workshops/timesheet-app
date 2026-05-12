import { test, expect } from '@playwright/test';
import { login, apiClearAllClients, createClient, createWorkEntry } from './helpers';

test.describe('Reporting', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
  });

  test('should show correct totals after creating entries', async ({ page }) => {
    await createClient(page, 'Report Client', { department: 'Finance' });
    await createWorkEntry(page, 'Report Client', '3', '01/10/2025', 'Task A');
    await createWorkEntry(page, 'Report Client', '5', '01/11/2025', 'Task B');
    await createWorkEntry(page, 'Report Client', '2', '01/12/2025', 'Task C');

    // Navigate to reports
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Select the client
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Verify total hours (3 + 5 + 2 = 10)
    await expect(page.getByText('10.00')).toBeVisible({ timeout: 5000 });

    // Verify entry count
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible();

    // Verify average hours per entry (10 / 3 = 3.33)
    await expect(page.getByText('3.33')).toBeVisible();

    // Verify individual entries appear in the table
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
    await expect(page.getByText('Task C')).toBeVisible();
  });

  test('should show zero totals when client has no entries', async ({ page }) => {
    await createClient(page, 'Empty Client');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Empty Client' }).click();

    await expect(page.getByText('0.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No work entries found for this client')).toBeVisible();
  });

  test('should prompt to create client when none exist', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });

  test('should display report for correct client when switching', async ({ page }) => {
    // Create two clients with different hours
    await createClient(page, 'Client X');
    await createClient(page, 'Client Y');
    await createWorkEntry(page, 'Client X', '8', '02/01/2025', 'Full day X');
    await createWorkEntry(page, 'Client Y', '4', '02/01/2025', 'Half day Y');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Select Client X
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Client X' }).click();
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Full day X')).toBeVisible();

    // Switch to Client Y
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Client Y' }).click();
    await expect(page.getByText('4.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Half day Y')).toBeVisible();
  });
});
