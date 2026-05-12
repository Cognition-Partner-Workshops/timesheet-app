import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);

    // Ensure at least one client exists
    await page.goto('/clients');
    const addButton = page.getByRole('button', { name: 'Add Client' });
    await addButton.waitFor({ timeout: 5000 });

    // Check if we need to create a client
    const tableText = await page.locator('table').textContent().catch(() => '');
    if (tableText?.includes('No clients found')) {
      await addButton.click();
      await page.getByLabel('Client Name').fill('Work Entry Test Client');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // Select client from MUI Select dropdown
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();

    // Fill hours
    await page.getByLabel('Hours').fill('4');

    // Fill description
    await page.getByLabel('Description').fill('Worked on project setup');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify entry appears in list
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Worked on project setup')).toBeVisible();
  });

  test('should verify work entry appears in list', async ({ page }) => {
    // Create an entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('2.5');
    await page.getByLabel('Description').fill('Code review session');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify it appears
    await expect(page.getByText('2.5 hours')).toBeVisible();
    await expect(page.getByText('Code review session')).toBeVisible();
  });

  test('should edit hours on a work entry', async ({ page }) => {
    // Create entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Entry to edit');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Edit the entry
    const row = page.getByRole('row').filter({ hasText: 'Entry to edit' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();

    await expect(page.getByText('Edit Work Entry')).toBeVisible();
    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('6');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('6 hours')).toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    // Create entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('1');
    await page.getByLabel('Description').fill('Entry to delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Entry to delete')).toBeVisible();

    // Delete the entry
    page.on('dialog', (dialog) => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('Entry to delete')).toBeHidden({ timeout: 5000 });
  });
});
