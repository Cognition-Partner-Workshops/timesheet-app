import { test, expect } from '@playwright/test';
import { login, resetBackend, apiCreateClient } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await expect(page.getByText('No clients found')).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@example.com');
    await page.getByLabel('Description').fill('Main client');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'acme@example.com' })).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await apiCreateClient('Old Name', { department: 'Sales' });
    await page.reload();
    await expect(page.getByRole('cell', { name: 'Old Name' })).toBeVisible({ timeout: 5000 });

    // Find the row and click its edit button
    const row = page.getByRole('row').filter({ hasText: 'Old Name' });
    await row.locator('[data-testid="EditIcon"]').click();
    await expect(page.getByText('Edit Client')).toBeVisible();

    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('New Name');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('cell', { name: 'New Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Old Name' })).not.toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    await apiCreateClient('To Delete');
    await page.reload();
    await expect(page.getByRole('cell', { name: 'To Delete' })).toBeVisible({ timeout: 5000 });

    page.on('dialog', (dialog) => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'To Delete' });
    await row.locator('[data-testid="DeleteIcon"]').click();

    await expect(page.getByRole('cell', { name: 'To Delete' })).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});
