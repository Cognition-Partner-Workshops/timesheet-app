import { test, expect } from '@playwright/test';
import { navigateViaSidebar, resetAndCreateClient } from '../fixtures/auth';

const CLIENT_NAME = 'Work Entry Test Client';

test.describe('Work Entries Page', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetAndCreateClient(page, request, CLIENT_NAME);
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
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await page.getByLabel('Hours').fill('4');
    await page.getByLabel('Description').fill('Smoke test work entry');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(CLIENT_NAME)).toBeVisible();
    await expect(page.getByText('Smoke test work entry')).toBeVisible();
  });
});
