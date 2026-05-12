import { test, expect } from '@playwright/test';
import {
  login, clearAllClients, createClient, setupDialogHandler,
  navigateToWorkEntries, createWorkEntry, clickRowAction,
} from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    setupDialogHandler(page);
    await login(page);
    await clearAllClients(page);
    await createClient(page, 'Test Client Co');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await navigateToWorkEntries(page);
    await createWorkEntry(page, 'Test Client Co', '4.5', 'Implemented new feature');

    await expect(page.getByText('Test Client Co').first()).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Implemented new feature')).toBeVisible();
  });

  test('should edit work entry hours', async ({ page }) => {
    await navigateToWorkEntries(page);
    await createWorkEntry(page, 'Test Client Co', '3', 'Initial work');
    await expect(page.getByText('3 hours')).toBeVisible();

    await clickRowAction(page, 'Test Client Co', 'EditIcon');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('7');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('7 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).toBeHidden();
  });

  test('should delete a work entry', async ({ page }) => {
    await navigateToWorkEntries(page);
    await createWorkEntry(page, 'Test Client Co', '2', 'To be removed');
    await expect(page.getByText('To be removed')).toBeVisible();

    await clickRowAction(page, 'Test Client Co', 'DeleteIcon');

    await expect(page.getByText('To be removed')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText(/No work entries found/)).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await clearAllClients(page);
    await page.goto('/work-entries');
    await expect(page.getByText(/You need to create at least one client/)).toBeVisible();
  });
});
