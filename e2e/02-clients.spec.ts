import { test, expect } from '@playwright/test';
import { login, fillAndSubmitClientForm } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/clients');
  });

  test('should create a new client', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Description').fill('Test client for E2E');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await fillAndSubmitClientForm(page, 'Edit Test Client');
    await expect(page.getByText('Edit Test Client')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Edit Test Client' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();

    await expect(page.getByText('Edit Client')).toBeVisible();
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Client Name');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Updated Client Name')).toBeVisible();
    await expect(page.getByText('Edit Test Client')).toBeHidden();
  });

  test('should delete a client', async ({ page }) => {
    await fillAndSubmitClientForm(page, 'Delete Me Client');
    await expect(page.getByText('Delete Me Client')).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'Delete Me Client' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('Delete Me Client')).toBeHidden({ timeout: 5000 });
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.evaluate(() => { window.confirm = () => true; });

    const clearButton = page.getByRole('button', { name: /Clear All/i });
    await clearButton.waitFor({ timeout: 5000 });

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/clients') && resp.request().method() === 'DELETE'),
      clearButton.click(),
    ]);

    await expect(page.getByText(/No clients found/)).toBeVisible({ timeout: 10000 });
  });
});
