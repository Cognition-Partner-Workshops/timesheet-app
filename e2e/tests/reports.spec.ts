import { test, expect } from '@playwright/test';
import { navigateViaSidebar, deleteAllClients } from '../fixtures/auth';

test.describe('Reports Page', () => {
  test('should display the reports page heading', async ({ page }) => {
    await page.goto('/dashboard');
    await navigateViaSidebar(page, 'Reports');
    await expect(page.locator('h4').filter({ hasText: 'Reports' })).toBeVisible();
  });

  test('should show a message when no clients exist', async ({ page, request }) => {
    await deleteAllClients(request);
    await page.goto('/dashboard');
    await navigateViaSidebar(page, 'Reports');

    await expect(page.getByText('You need to create at least one client')).toBeVisible();
  });

  test('should display client selector after creating a client', async ({ page, request }) => {
    await deleteAllClients(request);
    await page.goto('/dashboard');

    // Create a client first
    await navigateViaSidebar(page, 'Clients');
    await page.getByRole('button', { name: /Add Client/i }).click();
    await page.getByLabel('Client Name').fill('Reports Test Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Reports Test Client')).toBeVisible();

    // Navigate to Reports
    await navigateViaSidebar(page, 'Reports');
    await expect(page.locator('.MuiSelect-select')).toBeVisible();
  });

  test('should show report data when a client is selected', async ({ page, request }) => {
    await deleteAllClients(request);
    await page.goto('/dashboard');

    // Create a client
    await navigateViaSidebar(page, 'Clients');
    await page.getByRole('button', { name: /Add Client/i }).click();
    await page.getByLabel('Client Name').fill('Report Data Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Report Data Client')).toBeVisible();

    // Navigate to Reports and select the client
    await navigateViaSidebar(page, 'Reports');
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Report Data Client' }).click();

    // Verify summary cards appear
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText('Total Entries')).toBeVisible();
  });
});
