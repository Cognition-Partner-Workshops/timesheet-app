import { test, expect } from '@playwright/test';
import { login, cleanupViaApi } from './helpers';

async function selectClient(page: import('@playwright/test').Page, clientName: string) {
  // MUI Select: click the combobox then select the option
  await page.locator('.MuiFormControl-root', { hasText: 'Client' }).locator('[role="combobox"]').click();
  await page.getByRole('option', { name: clientName }).click();
}

test.describe('Work Entry Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await cleanupViaApi(page);
    // Create a client via API for work entry tests
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail');
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email! },
        body: JSON.stringify({ name: 'Test Client' }),
      });
    });
  });

  test('should create a work entry for a client', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    await selectClient(page, 'Test Client');
    await page.getByLabel('Hours').fill('4.5');
    await page.getByLabel('Description').fill('Development work');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Work Entry')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Test Client')).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Development work')).toBeVisible();
  });

  test('should edit hours on a work entry', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    // Create entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectClient(page, 'Test Client');
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Initial work');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Work Entry')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('3 hours')).toBeVisible();

    // Edit
    await page.locator('tr', { hasText: 'Test Client' }).getByRole('button').first().click();
    await expect(page.getByText('Edit Work Entry')).toBeVisible();
    await page.getByLabel('Hours').fill('7');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Edit Work Entry')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText('7 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).not.toBeVisible();
  });

  test('should delete a work entry', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    // Create entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectClient(page, 'Test Client');
    await page.getByLabel('Hours').fill('2');
    await page.getByLabel('Description').fill('To be deleted');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Work Entry')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('To be deleted')).toBeVisible();

    // Delete
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('tr', { hasText: 'Test Client' }).getByRole('button').nth(1).click();
    await expect(page.getByText('To be deleted')).not.toBeVisible({ timeout: 10000 });
  });

  test('should show message when no work entries exist', async ({ page }) => {
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  test('should show prompt to create client if none exist', async ({ page }) => {
    await cleanupViaApi(page);
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText('You need to create at least one client before adding work entries')
    ).toBeVisible();
  });
});
