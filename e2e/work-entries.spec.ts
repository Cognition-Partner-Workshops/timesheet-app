import { test, expect } from '@playwright/test';
import { createClientViaAPI } from './helpers';

test.describe('Work Entries Management', () => {
  test('should show work entries page heading', async ({ page }) => {
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries', exact: true })).toBeVisible();
  });

  test('should create, edit, and delete a work entry', async ({ page, request }) => {
    const suffix = Date.now();
    const clientName = `WE Client ${suffix}`;
    await createClientViaAPI(request, clientName);
    await page.goto('/work-entries');

    await expect(page.getByRole('button', { name: 'Add Work Entry' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hours' })).toBeVisible();

    // Create a work entry via the dialog
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();
    await page.getByRole('spinbutton', { name: 'Hours' }).fill('4');
    await page.getByRole('textbox', { name: 'Description' }).fill('Initial work');
    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for the new entry to appear in the table
    await expect(page.getByRole('heading', { name: clientName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('4 hours')).toBeVisible();
    await expect(page.getByText('Initial work')).toBeVisible();

    // Edit the work entry
    const row = page.getByRole('row').filter({ hasText: clientName }).filter({ hasText: '4 hours' });
    await row.getByRole('button').first().click();
    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    await page.getByRole('spinbutton', { name: 'Hours' }).clear();
    await page.getByRole('spinbutton', { name: 'Hours' }).fill('8');
    await page.getByRole('textbox', { name: 'Description' }).clear();
    await page.getByRole('textbox', { name: 'Description' }).fill('Updated work');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('8 hours')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Updated work')).toBeVisible();

    // Delete the work entry
    page.on('dialog', (d) => d.accept());
    const entryRow = page.getByRole('row').filter({ hasText: clientName }).filter({ hasText: '8 hours' });
    await entryRow.getByRole('button').nth(1).click();

    await expect(entryRow).not.toBeVisible({ timeout: 10000 });
  });
});
