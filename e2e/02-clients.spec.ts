import { test, expect } from '@playwright/test';
import { login, deleteAllClients } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
  });

  test('should create a new client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@example.com');
    await page.getByLabel('Description').fill('Test client description');

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Acme Corp')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Create a client first
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Original Name');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Original Name')).toBeVisible({ timeout: 5000 });

    // Click the edit icon button
    await page.locator('td .MuiIconButton-colorPrimary').first().click();
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Name');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('Updated Name')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Create a client first
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('To Delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'To Delete' })).toBeVisible({ timeout: 5000 });

    // Set up dialog handler before clicking delete
    page.on('dialog', dialog => dialog.accept());
    await page.locator('td .MuiIconButton-colorError').first().click();

    // Wait for the client to be removed
    await expect(page.getByRole('heading', { name: 'To Delete' })).not.toBeVisible({ timeout: 10000 });
  });
});
