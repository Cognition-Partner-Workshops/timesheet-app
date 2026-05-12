import { test, expect } from '@playwright/test';
import { login, deleteAllClients } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);

    // Create a test client for work entries
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Test Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Test Client', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    // Select client from the MUI Select dropdown
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Test Client' }).click();

    await page.getByLabel('Hours').fill('4');
    await page.getByLabel('Description').fill('Development work');

    await page.getByRole('button', { name: 'Create' }).click();

    // Verify it appears in the table
    await expect(page.getByText('4 hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Development work')).toBeVisible();
  });

  test('should edit hours on a work entry', async ({ page }) => {
    // Create an entry first
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Test Client' }).click();
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Initial work');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 5000 });

    // Edit the entry
    await page.locator('td .MuiIconButton-colorPrimary').first().click();
    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill('6');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('6 hours')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a work entry', async ({ page }) => {
    // Create an entry first
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Test Client' }).click();
    await page.getByLabel('Hours').fill('2');
    await page.getByLabel('Description').fill('Entry to delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Entry to delete')).toBeVisible({ timeout: 5000 });

    // Delete the entry
    page.on('dialog', dialog => dialog.accept());
    await page.locator('td .MuiIconButton-colorError').first().click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('Entry to delete')).not.toBeVisible({ timeout: 5000 });
  });
});
