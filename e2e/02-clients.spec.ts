import { test, expect } from '@playwright/test';
import { login, deleteAllClients, createClient, navigateTo, clickEditButton, clickDeleteButton } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
  });

  test('should create a new client', async ({ page }) => {
    await createClient(page, 'Acme Corp', {
      department: 'Engineering',
      email: 'acme@example.com',
      description: 'Test client description',
    });
    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await createClient(page, 'Original Name');

    await clickEditButton(page);
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Name');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('Updated Name')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a client', async ({ page }) => {
    await createClient(page, 'To Delete');

    await clickDeleteButton(page);
    await expect(page.getByRole('heading', { name: 'To Delete' })).not.toBeVisible({ timeout: 10000 });
  });
});
