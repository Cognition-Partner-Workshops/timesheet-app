import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test('should display clients page with table headers', async ({ page }) => {
    await page.goto('/clients');

    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Department' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('should open and close the add client dialog', async ({ page }) => {
    await page.goto('/clients');

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();
    await expect(page.getByLabel('Client Name')).toBeVisible();
    await expect(page.getByLabel('Department')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Add New Client')).not.toBeVisible();
  });

  test('should create, edit, and delete a client', async ({ page }) => {
    await page.goto('/clients');

    // Create a client
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Test Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('test@corp.com');
    await page.getByLabel('Description').fill('A test client');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: 'Test Corp' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'test@corp.com' })).toBeVisible();

    // Edit the client
    const row = page.getByRole('row').filter({ hasText: 'Test Corp' });
    await row.getByRole('button').first().click();
    await expect(page.getByText('Edit Client')).toBeVisible();
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Corp');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('cell', { name: 'Updated Corp' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Test Corp' })).not.toBeVisible();

    // Delete the client
    page.on('dialog', (dialog) => dialog.accept());
    const updatedRow = page.getByRole('row').filter({ hasText: 'Updated Corp' });
    await updatedRow.getByRole('button').nth(1).click();

    await expect(page.getByRole('cell', { name: 'Updated Corp' })).not.toBeVisible();
  });

  test('should clear all clients', async ({ page }) => {
    await page.goto('/clients');

    // Create a client first
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Temp Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('cell', { name: 'Temp Client' })).toBeVisible();

    // Clear all
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});
