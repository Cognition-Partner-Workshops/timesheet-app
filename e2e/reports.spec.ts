import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry, selectReportClient } from './helpers';

test.describe('Reporting', () => {
  test('should show correct totals and individual entries for a client report', async ({ page }) => {
    const email = uniqueEmail('reports');
    await login(page, email);
    await createClient(page, 'Report Client');
    await createWorkEntry(page, 'Report Client', '3', 'Report entry 1');
    await createWorkEntry(page, 'Report Client', '5.5', 'Report entry 2');

    await selectReportClient(page, 'Report Client');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Verify totals: 3 + 5.5 = 8.5 hours, 2 entries, 4.25 avg
    await expect(page.getByText('8.50')).toBeVisible();
    await expect(page.getByText('2').first()).toBeVisible();
    await expect(page.getByText('4.25')).toBeVisible();

    // Verify individual entries are listed
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
