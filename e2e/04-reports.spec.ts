import { test, expect } from '@playwright/test';
import { login } from './helpers';

let testCounter = 0;

test.describe('Reporting', () => {
  let clientName: string;

  test.beforeEach(async ({ page }) => {
    testCounter++;
    clientName = `Report Client ${Date.now()}-${testCounter}`;

    await login(page);

    // Create a client for report testing
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill(clientName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Create work entries
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    for (const hours of ['3', '5', '2']) {
      await page.getByRole('button', { name: 'Add Work Entry' }).click();
      await page.locator('.MuiSelect-select').click();
      await page.getByRole('option').filter({ hasText: clientName }).click();
      await page.getByLabel('Hours').fill(hours);
      await page.getByLabel('Description').fill(`Work for ${hours} hours`);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }
  });

  test('should show correct totals after creating entries', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Select the client
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').filter({ hasText: clientName }).click();

    // Wait for report to load
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 5000 });

    // Verify totals: 3 + 5 + 2 = 10 hours, 3 entries
    await expect(page.getByText('10.00')).toBeVisible();

    // Verify average: 10/3 = 3.33
    await expect(page.getByText('3.33')).toBeVisible();
  });

  test('should display individual entries in report table', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').filter({ hasText: clientName }).click();

    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 5000 });

    // Verify entries are listed
    await expect(page.getByText('Work for 3 hours').first()).toBeVisible();
    await expect(page.getByText('Work for 5 hours').first()).toBeVisible();
    await expect(page.getByText('Work for 2 hours').first()).toBeVisible();
  });

  test('should show empty state when no client is selected', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    // Only the client selector should be visible, no report data
    await expect(page.getByText('Total Hours')).toBeHidden();
  });
});
