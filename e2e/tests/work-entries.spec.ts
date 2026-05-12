import { test, expect } from '@playwright/test';
import { navigateViaSidebar, deleteAllClients } from '../fixtures/auth';

test.describe('Work Entries Page', () => {
  test.beforeEach(async ({ page, request }) => {
    // Clean up to avoid duplicate client names
    await deleteAllClients(request);

    // Create a client first (needed for work entries)
    await page.goto('/dashboard');
    await navigateViaSidebar(page, 'Clients');
    await page.getByRole('button', { name: /Add Client/i }).click();
    await page.getByLabel('Client Name').fill('Work Entry Test Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Work Entry Test Client')).toBeVisible();

    // Navigate to Work Entries
    await navigateViaSidebar(page, 'Work Entries');
    await expect(page).toHaveURL(/\/work-entries/);
  });

  test('should display the work entries page heading', async ({ page }) => {
    await expect(page.locator('h4').filter({ hasText: 'Work Entries' })).toBeVisible();
  });

  test('should show the Add Work Entry button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Work Entry/i })).toBeVisible();
  });

  test('should open the Add Work Entry dialog', async ({ page }) => {
    await page.getByRole('button', { name: /Add Work Entry/i }).click();

    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await expect(page.getByLabel('Hours')).toBeVisible();
  });

  test('should create a new work entry', async ({ page }) => {
    await page.getByRole('button', { name: /Add Work Entry/i }).click();

    // Select client from MUI Select dropdown
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Work Entry Test Client' }).click();

    // Fill in hours
    await page.getByLabel('Hours').fill('4');

    // Fill in description
    await page.getByLabel('Description').fill('Smoke test work entry');

    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the entry appears in the table
    await expect(page.getByText('Work Entry Test Client')).toBeVisible();
    await expect(page.getByText('Smoke test work entry')).toBeVisible();
  });
});
