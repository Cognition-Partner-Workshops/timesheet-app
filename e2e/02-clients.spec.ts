import { test, expect } from '@playwright/test';
import { login, createClient, cleanupViaApi } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await cleanupViaApi(page);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new client', async ({ page }) => {
    await createClient(page, 'Acme Corp', {
      department: 'Engineering',
      email: 'contact@acme.com',
      description: 'Primary client for web projects',
    });
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await createClient(page, 'Old Name');
    await expect(page.getByText('Old Name')).toBeVisible();

    // Click the edit button for the client row
    await page.locator('tr', { hasText: 'Old Name' }).getByRole('button').first().click();
    await expect(page.getByText('Edit Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('New Name');
    await page.getByLabel('Department').fill('Sales');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('Edit Client')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('New Name')).toBeVisible();
    await expect(page.getByText('Sales')).toBeVisible();
    await expect(page.getByText('Old Name')).not.toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    await createClient(page, 'To Delete');
    await expect(page.getByText('To Delete')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    await page
      .locator('tr', { hasText: 'To Delete' })
      .getByRole('button')
      .nth(1)
      .click();

    await expect(page.getByText('To Delete')).not.toBeVisible({ timeout: 10000 });
  });

  test('should display no-clients message when empty', async ({ page }) => {
    await expect(page.getByText('No clients found')).toBeVisible();
  });

  test('should create multiple clients', async ({ page }) => {
    await createClient(page, 'Client Alpha');
    await createClient(page, 'Client Beta');
    await createClient(page, 'Client Gamma');

    await expect(page.getByText('Client Alpha')).toBeVisible();
    await expect(page.getByText('Client Beta')).toBeVisible();
    await expect(page.getByText('Client Gamma')).toBeVisible();
  });
});
