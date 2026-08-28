import { test, expect } from '@playwright/test';
import {
  loginAndNavigate,
  apiCreateClient,
  apiCreateWorkEntry,
  selectMuiOption,
  clickRowAction,
} from './helpers';

let clientId: number;

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, '/work-entries', 'Work Entries');
    const data = await apiCreateClient('Test Client');
    clientId = data.client.id;
    await page.reload();
  });

  test('should show empty state when no entries exist', async ({ page }) => {
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  test('should create a work entry and verify it appears in list', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    await selectMuiOption(page, 'Test Client');
    await page.getByLabel('Hours').fill('4.5');
    await page.getByLabel('Description').fill('Implemented login feature');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Test Client').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Implemented login feature')).toBeVisible();
  });

  test('should edit work entry hours', async ({ page }) => {
    await apiCreateWorkEntry(clientId, 3, 'Original entry');
    await page.reload();
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 5000 });

    await clickRowAction(page, '3 hours', 'EditIcon');
    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('6');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('6 hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('3 hours')).not.toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    await apiCreateWorkEntry(clientId, 2, 'To be deleted');
    await page.reload();
    await expect(page.getByText('2 hours')).toBeVisible({ timeout: 5000 });

    page.on('dialog', (dialog) => dialog.accept());
    await clickRowAction(page, '2 hours', 'DeleteIcon');

    await expect(page.getByText('2 hours')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });
});
