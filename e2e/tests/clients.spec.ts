import { test, expect } from '@playwright/test';
import { navigateViaSidebar } from '../fixtures/auth';

test.describe('Clients Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await navigateViaSidebar(page, 'Clients');
  });

  test('should display the clients page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();
  });

  test('should show the Add Client button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Client/i })).toBeVisible();
  });

  test('should open the Add Client dialog', async ({ page }) => {
    await page.getByRole('button', { name: /Add Client/i }).click();

    await expect(page.getByText('Add New Client')).toBeVisible();
    await expect(page.getByLabel('Client Name')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    await page.getByRole('button', { name: /Add Client/i }).click();

    await page.getByLabel('Client Name').fill('Smoke Test Client');
    await page.getByLabel('Description').fill('Created by smoke test');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Smoke Test Client')).toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    // Create a client to delete
    await page.getByRole('button', { name: /Add Client/i }).click();
    await page.getByLabel('Client Name').fill('Client To Delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Client To Delete')).toBeVisible();

    // Accept the confirmation dialog before clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // Click the delete icon button (error-colored) in the row
    const row = page.getByRole('row').filter({ hasText: 'Client To Delete' });
    await row.locator('.MuiIconButton-colorError').click();

    await expect(page.getByText('Client To Delete')).not.toBeVisible();
  });
});
