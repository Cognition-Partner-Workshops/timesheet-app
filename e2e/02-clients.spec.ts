import { test, expect } from '@playwright/test';
import {
  loginAndNavigate,
  apiCreateClient,
  openDialogAndFillForm,
  clickRowAction,
} from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, '/clients', 'Clients');
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await expect(page.getByText('No clients found')).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    await openDialogAndFillForm(page, 'Add Client', 'Add New Client', {
      'Client Name': 'Acme Corp',
      Department: 'Engineering',
      Email: 'acme@example.com',
      Description: 'Main client',
    });
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'acme@example.com' })).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await apiCreateClient('Old Name', { department: 'Sales' });
    await page.reload();
    await expect(page.getByRole('cell', { name: 'Old Name' })).toBeVisible({ timeout: 5000 });

    await clickRowAction(page, 'Old Name', 'EditIcon');
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
    await clickRowAction(page, 'To Delete', 'DeleteIcon');

    await expect(page.getByRole('cell', { name: 'To Delete' })).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});
