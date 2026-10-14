import { test, expect } from '@playwright/test';
import { login, ensureClientExists, createWorkEntry } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureClientExists(page, 'Work Entry Test Client');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('4');
    await page.getByLabel('Description').fill('Worked on project setup');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Worked on project setup')).toBeVisible();
  });

  test('should verify work entry appears in list', async ({ page }) => {
    await createWorkEntry(page, 'Work Entry Test Client', '2.5', 'Code review session');
    await expect(page.getByText('2.5 hours')).toBeVisible();
    await expect(page.getByText('Code review session')).toBeVisible();
  });

  test('should edit hours on a work entry', async ({ page }) => {
    await createWorkEntry(page, 'Work Entry Test Client', '3', 'Entry to edit');

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
    await createWorkEntry(page, 'Work Entry Test Client', '1', 'Entry to delete');
    await expect(page.getByText('Entry to delete')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('Entry to delete')).toBeHidden({ timeout: 5000 });
  });
});
