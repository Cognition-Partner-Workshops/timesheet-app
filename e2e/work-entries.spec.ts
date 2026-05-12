import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test('should create a work entry for a client', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'WE Create Client');
    await createWorkEntry(page, 'WE Create Client', '4.5', 'Frontend development work');

    await expect(page.getByText('WE Create Client')).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Frontend development work')).toBeVisible();
  });

  test('should edit hours on an existing work entry', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'WE Edit Client');
    await createWorkEntry(page, 'WE Edit Client', '3', 'Initial entry');
    await expect(page.getByText('3 hours')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Initial entry' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('6');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('6 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).not.toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'WE Delete Client');
    await createWorkEntry(page, 'WE Delete Client', '2', 'Entry to delete');
    await expect(page.getByText('Entry to delete')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'Entry to delete' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();
    await expect(page.getByText('Entry to delete')).not.toBeVisible();
  });

  test('should show empty state when no entries exist', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'Empty State Client');
    await page.goto('/work-entries');
    await expect(page.getByText(/no work entries found/i)).toBeVisible();
  });
});
