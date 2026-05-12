import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry, clickEditButton, clickDeleteButton } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test('should create a work entry for a client', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'WE Create Client');
    await createWorkEntry(page, 'WE Create Client', '4.5', 'Frontend development work');

    await expect(page.getByText('WE Create Client')).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Frontend development work')).toBeVisible();
  });

  test('should edit hours and then delete a work entry', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'WE Lifecycle Client');
    await createWorkEntry(page, 'WE Lifecycle Client', '3', 'Lifecycle entry');
    await expect(page.getByText('3 hours')).toBeVisible();

    // Edit hours
    await clickEditButton(page, 'Lifecycle entry');
    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('6');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('6 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).not.toBeVisible();

    // Delete the entry
    await clickDeleteButton(page, 'Lifecycle entry');
    await expect(page.getByText('Lifecycle entry')).not.toBeVisible();
  });

  test('should show empty state when no entries exist', async ({ page }) => {
    await login(page, uniqueEmail('work'));
    await createClient(page, 'Empty State Client');
    await page.goto('/work-entries');
    await expect(page.getByText(/no work entries found/i)).toBeVisible();
  });
});
