import { test, expect } from '@playwright/test';
import { login, deleteAllClients, createClient, createWorkEntry, navigateTo, clickEditButton, clickDeleteButton } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
    await createClient(page, 'Test Client');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '4', 'Development work');
    await expect(page.getByText('4 hours')).toBeVisible();
  });

  test('should edit hours on a work entry', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '3', 'Initial work');

    await clickEditButton(page);
    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill('6');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('6 hours')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a work entry', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '2', 'Entry to delete');

    await clickDeleteButton(page);
    await page.waitForTimeout(1000);
    await expect(page.getByText('Entry to delete')).not.toBeVisible({ timeout: 5000 });
  });
});
