import { test, expect } from '@playwright/test';
import { login, navigateTo, uniqueName, resetDatabase } from './helpers';

test.describe('Client Management', () => {
  test.beforeAll(async () => { await resetDatabase(); });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'Clients');
  });

  test('should create a new client', async ({ page }) => {
    const clientName = uniqueName('Acme Corp');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await dialog.getByLabel('Client Name').fill(clientName);
    await dialog.getByLabel('Department').fill('Engineering');
    await dialog.getByLabel('Email').fill('contact@acme.com');
    await dialog.getByLabel('Description').fill('A test client for E2E');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: clientName })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    const clientName = uniqueName('Edit Corp');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill(clientName);
    await dialog.getByLabel('Department').fill('Sales');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: clientName })).toBeVisible({ timeout: 5000 });

    // Click edit button on the row (first icon button = edit)
    const row = page.getByRole('row').filter({ hasText: clientName });
    await row.getByRole('button').first().click();

    // Update client name
    const newName = uniqueName('Edited Corp');
    await expect(dialog.getByRole('heading', { name: 'Edit Client' })).toBeVisible();
    await dialog.getByLabel('Client Name').clear();
    await dialog.getByLabel('Client Name').fill(newName);
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: newName })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: clientName })).not.toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    const clientName = uniqueName('Delete Corp');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill(clientName);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: clientName })).toBeVisible({ timeout: 5000 });

    // Accept the confirmation dialog
    page.on('dialog', d => d.accept());

    // Click delete button (second icon button = delete)
    const row = page.getByRole('row').filter({ hasText: clientName });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByRole('cell', { name: clientName })).not.toBeVisible({ timeout: 5000 });
  });
});
