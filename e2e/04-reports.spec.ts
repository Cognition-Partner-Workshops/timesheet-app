import { test, expect } from '@playwright/test';
import { login, createClient, createWorkEntry } from './helpers';

let testCounter = 0;

test.describe('Reporting', () => {
  let clientName: string;

  test.beforeEach(async ({ page }) => {
    testCounter++;
    clientName = `Report Client ${Date.now()}-${testCounter}`;

    await login(page);
    await createClient(page, clientName);

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    for (const hours of ['3', '5', '2']) {
      await createWorkEntry(page, clientName, hours, `Work for ${hours} hours`);
    }
  });

  test('should show correct totals after creating entries', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').filter({ hasText: clientName }).click();

    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('10.00')).toBeVisible();
    await expect(page.getByText('3.33')).toBeVisible();
  });

  test('should display individual entries in report table', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').filter({ hasText: clientName }).click();

    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Work for 3 hours').first()).toBeVisible();
    await expect(page.getByText('Work for 5 hours').first()).toBeVisible();
    await expect(page.getByText('Work for 2 hours').first()).toBeVisible();
  });

  test('should show empty state when no client is selected', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Total Hours')).toBeHidden();
  });
});
