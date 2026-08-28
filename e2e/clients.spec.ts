import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, editFieldAndSave, deleteRowAndVerify } from './helpers';

test.describe('Client Management', () => {
  test('should create a new client with all fields', async ({ page }) => {
    await login(page, uniqueEmail('client'));
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@corp.com');
    await page.getByLabel('Description').fill('Test client for E2E');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('should edit and then delete a client', async ({ page }) => {
    await login(page, uniqueEmail('client'));
    await createClient(page, 'Lifecycle Corp');

    await editFieldAndSave(page, 'Lifecycle Corp', 'Client Name', 'Renamed Corp');
    await expect(page.getByText('Renamed Corp')).toBeVisible();
    await expect(page.getByText('Lifecycle Corp')).not.toBeVisible();

    await deleteRowAndVerify(page, 'Renamed Corp');
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await login(page, uniqueEmail('client'));
    await page.goto('/clients');
    await expect(page.getByText(/no clients found/i)).toBeVisible();
  });
});
