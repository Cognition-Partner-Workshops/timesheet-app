import { test, expect } from '@playwright/test';
import {
  resetTestState, createClient,
  navigateToWorkEntries, createWorkEntry, selectReportClient,
} from './helpers';

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('should show correct totals after creating entries', async ({ page }) => {
    await createClient(page, 'Report Client');
    await navigateToWorkEntries(page);
    await createWorkEntry(page, 'Report Client', '5', 'Task A');
    await createWorkEntry(page, 'Report Client', '3.5', 'Task B');

    await selectReportClient(page, 'Report Client');

    await expect(page.getByText('8.50')).toBeVisible({ timeout: 10000 });
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
    await selectReportClient(page, 'Empty Client');

    await expect(page.getByText('0.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No work entries found for this client/)).toBeVisible();
  });
});
