import { test, expect } from '@playwright/test';
import { login, createClient, createWorkEntry, deleteAllClients, deleteAllWorkEntries } from './helpers';

test.describe('Work Entry Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'workentry-test@example.com');
    await deleteAllWorkEntries(page);
    await deleteAllClients(page);
    // Create a client for work entries
    await createClient(page, {
      name: 'Work Entry Client',
      email: 'weclient@example.com',
    });
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select client
    await page.getByLabel('Client').click();
    await page.getByRole('option', { name: 'Work Entry Client' }).first().click();

    // Fill hours
    await page.getByLabel('Hours').fill('4');

    // Fill description
    await page.getByLabel('Description').fill('Development work');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify work entry appears in the list
    await expect(page.getByText('Work Entry Client')).toBeVisible();
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Development work')).toBeVisible();
  });

  test('should verify the work entry appears in the list after creation', async ({ page }) => {
    // Create a work entry
    await createWorkEntry(page, {
      clientName: 'Work Entry Client',
      hours: '6',
      description: 'Testing task',
    });

    await page.goto('/work-entries');
    const row = page.locator('tr', { hasText: 'Work Entry Client' });
    await expect(row).toBeVisible();
    await expect(row.getByText('6 hours')).toBeVisible();
    await expect(row.getByText('Testing task')).toBeVisible();
  });

  test('should edit a work entry', async ({ page }) => {
    // Create a work entry to edit
    await createWorkEntry(page, {
      clientName: 'Work Entry Client',
      hours: '3',
      description: 'Original description',
    });

    await page.goto('/work-entries');
    // Click edit on the entry
    const row = page.locator('tr', { hasText: 'Original description' });
    await row.locator('[data-testid="EditIcon"]').locator('..').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Update hours and description
    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill('5');

    const descField = page.getByLabel('Description');
    await descField.clear();
    await descField.fill('Updated description');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify updated values
    await expect(page.getByText('5 hours')).toBeVisible();
    await expect(page.getByText('Updated description')).toBeVisible();
    await expect(page.getByText('Original description')).not.toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    // Create a work entry to delete
    await createWorkEntry(page, {
      clientName: 'Work Entry Client',
      hours: '2',
      description: 'Entry to delete',
    });

    await page.goto('/work-entries');
    await expect(page.getByText('Entry to delete')).toBeVisible();

    // Handle confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete
    const row = page.locator('tr', { hasText: 'Entry to delete' });
    await row.locator('[data-testid="DeleteIcon"]').locator('..').first().click();

    // Verify entry is removed
    await expect(page.getByText('Entry to delete')).not.toBeVisible({ timeout: 10000 });
  });

  test('should show empty state when no work entries exist', async ({ page }) => {
    await page.goto('/work-entries');
    await expect(
      page.getByText('No work entries found. Add your first work entry to get started.'),
    ).toBeVisible();
  });

  test('should show prompt to create client when no clients exist', async ({ page }) => {
    // Delete all work entries and clients
    await deleteAllWorkEntries(page);
    await deleteAllClients(page);
    await page.goto('/work-entries');
    await expect(
      page.getByText('You need to create at least one client before adding work entries.'),
    ).toBeVisible({ timeout: 10000 });
  });
});
