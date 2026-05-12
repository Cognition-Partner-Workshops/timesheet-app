import { test, expect } from '@playwright/test';
import { login, apiClearAllClients, createClient, createWorkEntry } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
    await createClient(page, 'Test Client', { department: 'QA' });
  });

  test('should create a work entry for a client', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '4', '01/15/2025', 'Development work');

    // Verify entry appears in the list
    await expect(page.getByText('Test Client').first()).toBeVisible();
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Development work')).toBeVisible();
  });

  test('should verify work entry appears in list after creation', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '2.5', '01/20/2025', 'Code review');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('2.5 hours')).toBeVisible();
    await expect(page.getByText('Code review')).toBeVisible();
  });

  test('should edit work entry hours', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '3', '01/10/2025', 'Initial task');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    // Click edit on the entry row
    const row = page.getByRole('row').filter({ hasText: '3 hours' });
    await row.getByRole('button').first().click();
    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    // Update hours
    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('5');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify updated hours
    await expect(page.getByText('5 hours')).toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '6', '01/05/2025', 'Task to delete');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('6 hours')).toBeVisible();

    // Handle confirmation dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Click delete on the entry row
    const row = page.getByRole('row').filter({ hasText: '6 hours' });
    await row.getByRole('button').nth(1).click();

    // Verify entry is removed
    await expect(page.getByText('6 hours')).toBeHidden({ timeout: 5000 });
  });

  test('should show empty state when no work entries exist', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });

  test('should show prompt to create client when no clients exist', async ({ page, request }) => {
    await apiClearAllClients(request);
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });
});
