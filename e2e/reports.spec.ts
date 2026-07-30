import { test, expect } from '@playwright/test';
import { login, createClient, createWorkEntry, deleteAllClients, deleteAllWorkEntries } from './helpers';

test.describe('Reporting Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'report-test@example.com');
    await deleteAllWorkEntries(page);
    await deleteAllClients(page);
  });

  test('should show correct total hours for a client', async ({ page }) => {
    // Create a client and multiple work entries
    await createClient(page, { name: 'Report Client A' });
    await createWorkEntry(page, {
      clientName: 'Report Client A',
      hours: '3',
      description: 'Task 1',
    });
    await createWorkEntry(page, {
      clientName: 'Report Client A',
      hours: '5',
      description: 'Task 2',
    });

    // Navigate to reports
    await page.goto('/reports');
    // Select client
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Report Client A' }).first().click();

    // Verify total hours = 3 + 5 = 8
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 10000 });
    // Verify entry count = 2
    await expect(page.getByText('2').first()).toBeVisible();
  });

  test('should show work entries in the report table', async ({ page }) => {
    await createClient(page, { name: 'Report Client B' });
    await createWorkEntry(page, {
      clientName: 'Report Client B',
      hours: '4',
      description: 'Development',
    });
    await createWorkEntry(page, {
      clientName: 'Report Client B',
      hours: '2',
      description: 'Code review',
    });

    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Report Client B' }).first().click();

    // Wait for report to load
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 10000 });

    // Verify entries appear in the table
    await expect(page.getByText('Development')).toBeVisible();
    await expect(page.getByText('Code review')).toBeVisible();
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('2 hours')).toBeVisible();
  });

  test('should filter reports by client', async ({ page }) => {
    // Create two clients with different entries
    await createClient(page, { name: 'Client X' });
    await createClient(page, { name: 'Client Y' });

    await createWorkEntry(page, {
      clientName: 'Client X',
      hours: '7',
      description: 'X work',
    });
    await createWorkEntry(page, {
      clientName: 'Client Y',
      hours: '3',
      description: 'Y work',
    });

    await page.goto('/reports');

    // Select Client X
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Client X' }).first().click();
    await expect(page.getByText('7.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('X work')).toBeVisible();
    // Client Y's entries should NOT be visible
    await expect(page.getByText('Y work')).not.toBeVisible();

    // Switch to Client Y — use combobox role to avoid strict mode when listbox is open
    await page.getByRole('combobox', { name: 'Select Client' }).click();
    await page.getByRole('option', { name: 'Client Y' }).first().click();
    await expect(page.getByText('3.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Y work')).toBeVisible();
    await expect(page.getByText('X work')).not.toBeVisible();
  });

  test('should update report correctly when a work entry is edited', async ({ page }) => {
    await createClient(page, { name: 'Edit Report Client' });
    await createWorkEntry(page, {
      clientName: 'Edit Report Client',
      hours: '4',
      description: 'Before edit',
    });

    // Verify initial report
    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Edit Report Client' }).first().click();
    await expect(page.getByText('4.00').first()).toBeVisible({ timeout: 10000 });

    // Go to work entries and edit
    await page.goto('/work-entries');
    const row = page.locator('tr', { hasText: 'Before edit' });
    await row.locator('[data-testid="EditIcon"]').locator('..').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill('8');

    const descField = page.getByLabel('Description');
    await descField.clear();
    await descField.fill('After edit');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Go back to reports and verify updated totals
    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Edit Report Client' }).first().click();
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('After edit')).toBeVisible();
  });

  test('should update report correctly when a work entry is deleted', async ({ page }) => {
    await createClient(page, { name: 'Delete Report Client' });
    await createWorkEntry(page, {
      clientName: 'Delete Report Client',
      hours: '5',
      description: 'Keep this',
    });
    await createWorkEntry(page, {
      clientName: 'Delete Report Client',
      hours: '3',
      description: 'Delete this',
    });

    // Verify initial report totals = 8
    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Delete Report Client' }).first().click();
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 10000 });

    // Go to work entries and delete one
    await page.goto('/work-entries');
    page.on('dialog', (dialog) => dialog.accept());

    const row = page.locator('tr', { hasText: 'Delete this' });
    await row.locator('[data-testid="DeleteIcon"]').locator('..').first().click();
    await expect(page.getByText('Delete this')).not.toBeVisible({ timeout: 10000 });

    // Go back to reports and verify updated totals = 5
    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Delete Report Client' }).first().click();
    await expect(page.getByText('5.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Keep this')).toBeVisible();
    await expect(page.getByText('Delete this')).not.toBeVisible();
  });

  test('should show average hours per entry', async ({ page }) => {
    await createClient(page, { name: 'Average Client' });
    await createWorkEntry(page, {
      clientName: 'Average Client',
      hours: '6',
      description: 'Entry 1',
    });
    await createWorkEntry(page, {
      clientName: 'Average Client',
      hours: '4',
      description: 'Entry 2',
    });

    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Average Client' }).first().click();

    // Total hours = 10, entries = 2, average = 5.00
    await expect(page.getByText('10.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();
    await expect(page.getByText('5.00').first()).toBeVisible();
  });

  test('should show prompt to create client when no clients exist on reports page', async ({
    page,
  }) => {
    await page.goto('/reports');
    await expect(
      page.getByText('You need to create at least one client before generating reports.'),
    ).toBeVisible();
  });

  test('should show message to select a client before viewing report', async ({ page }) => {
    await createClient(page, { name: 'Prompt Client' });
    await page.goto('/reports');
    await expect(page.getByText('Select a client to view their time report.')).toBeVisible();
  });
});
