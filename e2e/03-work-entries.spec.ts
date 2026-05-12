import { test, expect } from '@playwright/test';
import { login, clearAllClients, createClient, setupDialogHandler } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    setupDialogHandler(page);
    await login(page);
    await clearAllClients(page);
    await createClient(page, 'Test Client Co');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select client via the combobox
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Test Client Co' }).click();

    await page.getByLabel('Hours').fill('4.5');
    await page.getByLabel('Description').fill('Implemented new feature');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Test Client Co').first()).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Implemented new feature')).toBeVisible();
  });

  test('should edit work entry hours', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Test Client Co' }).click();
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Initial work');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('3 hours')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Test Client Co' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('7');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('7 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).toBeHidden();
  });

  test('should delete a work entry', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Test Client Co' }).click();
    await page.getByLabel('Hours').fill('2');
    await page.getByLabel('Description').fill('To be removed');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('To be removed')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Test Client Co' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('To be removed')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText(/No work entries found/)).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await clearAllClients(page);
    await page.goto('/work-entries');
    await expect(page.getByText(/You need to create at least one client/)).toBeVisible();
  });
});
