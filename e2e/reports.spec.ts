import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry } from './helpers';

async function setupReportData(page: import('@playwright/test').Page) {
  const email = uniqueEmail('reports');
  await login(page, email);
  await createClient(page, 'Report Client');
  await createWorkEntry(page, 'Report Client', '3', 'Report entry 1');
  await createWorkEntry(page, 'Report Client', '5.5', 'Report entry 2');
}

test.describe('Reporting', () => {
  test('should show correct totals for a client report', async ({ page }) => {
    await setupReportData(page);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Select Client' }).click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    await expect(page.getByText('8.50')).toBeVisible();
    await expect(page.getByText('2').first()).toBeVisible();
    await expect(page.getByText('4.25')).toBeVisible();
  });

  test('should display individual entries in report table', async ({ page }) => {
    await setupReportData(page);
    await page.goto('/reports');

    await page.getByRole('combobox', { name: 'Select Client' }).click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    await expect(page.getByText('Report entry 1')).toBeVisible();
    await expect(page.getByText('Report entry 2')).toBeVisible();
    await expect(page.getByText('3 hours')).toBeVisible();
    await expect(page.getByText('5.5 hours')).toBeVisible();
  });

  test('should show prompt when no clients exist', async ({ page }) => {
    await login(page, uniqueEmail('reports'));
    await page.goto('/reports');
    await expect(page.getByText(/create at least one client/i)).toBeVisible();
  });
});
