import { test, expect } from '@playwright/test';
import {
  resetTestState, createClient, openClientDialog, fillClientForm,
  submitDialog, clickRowAction,
} from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('should create a new client', async ({ page }) => {
    await openClientDialog(page);
    await fillClientForm(page, 'Acme Corp', {
      department: 'Engineering',
      email: 'contact@acme.com',
      description: 'Primary client for web development',
    });
    await submitDialog(page);

    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await createClient(page, 'Old Name');

    await clickRowAction(page, 'Old Name', 'EditIcon');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Name');
    await page.getByLabel('Department').fill('Marketing');
    await submitDialog(page, 'Update');

    await expect(page.getByText('Updated Name')).toBeVisible();
    await expect(page.getByText('Marketing')).toBeVisible();
    await expect(page.getByText('Old Name')).toBeHidden();
  });

  test('should delete a client', async ({ page }) => {
    await createClient(page, 'To Be Deleted');

    await clickRowAction(page, 'To Be Deleted', 'DeleteIcon');
    await expect(page.getByText('To Be Deleted')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText(/No clients found/)).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByText(/No clients found/)).toBeVisible();
  });
});
