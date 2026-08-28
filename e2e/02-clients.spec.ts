import { test, expect } from '@playwright/test';
import { login, apiClearAllClients, navigateTo, openAddClientDialog, submitClientForm, quickCreateClient, deleteRowByText, editRowByText } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
  });

  test('should create a new client', async ({ page }) => {
    await openAddClientDialog(page);
    await submitClientForm(page, 'Acme Corp', {
      department: 'Engineering', email: 'contact@acme.com', description: 'Primary client',
    });

    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
    await expect(page.getByText('Primary client')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await openAddClientDialog(page);
    await submitClientForm(page, 'Original Client', { department: 'Sales' });
    await expect(page.getByText('Original Client')).toBeVisible();

    await editRowByText(page, 'Original Client');
    await expect(page.getByText('Edit Client')).toBeVisible();

    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Client');
    await page.getByLabel('Department').clear();
    await page.getByLabel('Department').fill('Marketing');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText('Updated Client')).toBeVisible();
    await expect(page.getByText('Marketing', { exact: true })).toBeVisible();
    await expect(page.getByText('Original Client')).toBeHidden();
  });

  test('should delete a client', async ({ page }) => {
    await openAddClientDialog(page);
    await submitClientForm(page, 'Client To Delete');
    await expect(page.getByText('Client To Delete')).toBeVisible();
    await deleteRowByText(page, 'Client To Delete');
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await navigateTo(page, '/clients');
    await expect(page.getByText('No clients found')).toBeVisible({ timeout: 5000 });
  });

  test('should create multiple clients', async ({ page }) => {
    await navigateTo(page, '/clients');
    await quickCreateClient(page, 'Client Alpha');
    await quickCreateClient(page, 'Client Beta');
    await expect(page.getByText('Client Alpha')).toBeVisible();
    await expect(page.getByText('Client Beta')).toBeVisible();
  });
});
