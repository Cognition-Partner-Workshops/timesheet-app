import { test, expect } from '@playwright/test';
import { login, apiClearAllClients, navigateTo, createClient, createWorkEntry, deleteRowByText, editRowByText } from './helpers';

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
    await createClient(page, 'Test Client', { department: 'QA' });
  });

  test('should create a work entry for a client', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '4', '01/15/2025', 'Development work');
    await expect(page.getByText('Test Client').first()).toBeVisible();
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Development work')).toBeVisible();
  });

  test('should verify work entry appears in list after creation', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '2.5', '01/20/2025', 'Code review');
    await navigateTo(page, '/work-entries');
    await expect(page.getByText('2.5 hours')).toBeVisible();
    await expect(page.getByText('Code review')).toBeVisible();
  });

  test('should edit work entry hours', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '3', '01/10/2025', 'Initial task');
    await navigateTo(page, '/work-entries');

    await editRowByText(page, '3 hours');
    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill('5');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('5 hours')).toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    await createWorkEntry(page, 'Test Client', '6', '01/05/2025', 'Task to delete');
    await navigateTo(page, '/work-entries');
    await expect(page.getByText('6 hours')).toBeVisible();
    await deleteRowByText(page, '6 hours');
  });

  test('should show empty state when no work entries exist', async ({ page }) => {
    await navigateTo(page, '/work-entries');
    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });

  test('should show prompt to create client when no clients exist', async ({ page, request }) => {
    await apiClearAllClients(request);
    await navigateTo(page, '/work-entries');
    await expect(page.getByText('You need to create at least one client')).toBeVisible({ timeout: 5000 });
  });
});
