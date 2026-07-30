import { test, expect } from '@playwright/test';
import { createClientViaAPI, createWorkEntryViaAPI } from './helpers';

test.describe('Reports', () => {
  test('should display reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('should show report with data and export buttons', async ({ page, request }) => {
    const suffix = Date.now();
    const client = await createClientViaAPI(request, `Report Client ${suffix}`);
    await createWorkEntryViaAPI(request, {
      clientId: client.id,
      hours: 5,
      description: 'Report test entry',
    });

    await page.goto('/reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: `Report Client ${suffix}` }).click();

    // Verify report summary cards
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();

    // Verify report table data
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hours' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByText('Report test entry')).toBeVisible();

    // Verify export buttons
    await expect(page.getByRole('button', { name: 'Export as CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export as PDF' })).toBeVisible();
  });

  test('should show empty message for client without entries', async ({ page, request }) => {
    const suffix = Date.now();
    await createClientViaAPI(request, `Empty Client ${suffix}`);

    await page.goto('/reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: `Empty Client ${suffix}` }).click();

    await expect(page.getByText('No work entries found for this client')).toBeVisible();
  });
});
