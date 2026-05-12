import { test, expect } from '@playwright/test';
import { login, apiClearAllClients } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
  });

  test('should create a new client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Description').fill('Primary client');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify client appears in the table
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
    await expect(page.getByText('Primary client')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Original Client');
    await page.getByLabel('Department').fill('Sales');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Original Client')).toBeVisible();

    // Click edit button on the row
    const row = page.getByRole('row').filter({ hasText: 'Original Client' });
    await row.getByRole('button').first().click();
    await expect(page.getByText('Edit Client')).toBeVisible();

    // Update the name
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Client');
    await page.getByLabel('Department').clear();
    await page.getByLabel('Department').fill('Marketing');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify changes
    await expect(page.getByText('Updated Client')).toBeVisible();
    await expect(page.getByText('Marketing', { exact: true })).toBeVisible();
    await expect(page.getByText('Original Client')).toBeHidden();
  });

  test('should delete a client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Client To Delete');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Client To Delete')).toBeVisible();

    // Handle confirmation dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Click delete button on the row
    const row = page.getByRole('row').filter({ hasText: 'Client To Delete' });
    await row.getByRole('button').nth(1).click();

    // Verify client is removed
    await expect(page.getByText('Client To Delete')).toBeHidden({ timeout: 5000 });
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No clients found')).toBeVisible({ timeout: 5000 });
  });

  test('should create multiple clients', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Create first client
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Client Alpha');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Create second client
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Client Beta');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText('Client Alpha')).toBeVisible();
    await expect(page.getByText('Client Beta')).toBeVisible();
  });
});
