import { test, expect } from '@playwright/test';
import { login, clearAllClients, setupDialogHandler } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    setupDialogHandler(page);
    await login(page);
    await clearAllClients(page);
  });

  test('should create a new client', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Description').fill('Primary client for web development');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Old Name');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Old Name')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Old Name' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Name');
    await page.getByLabel('Department').fill('Marketing');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Updated Name')).toBeVisible();
    await expect(page.getByText('Marketing')).toBeVisible();
    await expect(page.getByText('Old Name')).toBeHidden();
  });

  test('should delete a client', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('To Be Deleted');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('To Be Deleted')).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'To Be Deleted' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('To Be Deleted')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText(/No clients found/)).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByText(/No clients found/)).toBeVisible();
  });
});
