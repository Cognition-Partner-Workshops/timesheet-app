import { test, expect } from '@playwright/test';
import { acceptNextConfirm, createClient, gotoSection, login, uniqueEmail, uniqueName } from './helpers';

test.describe('Client management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, uniqueEmail('clients'));
    await gotoSection(page, 'Clients');
  });

  test('creates a client', async ({ page }) => {
    const name = uniqueName('Acme');
    await createClient(page, name, {
      department: 'Engineering',
      email: 'contact@acme.com',
      description: 'Primary client',
    });

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('Engineering');
    await expect(row).toContainText('contact@acme.com');
    await expect(row).toContainText('Primary client');
  });

  test('edits a client', async ({ page }) => {
    const name = uniqueName('Beta');
    const renamed = `${name} Renamed`;
    await createClient(page, name, { department: 'Sales' });

    await page.getByRole('row', { name: new RegExp(name) }).getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit Client' })).toBeVisible();
    await dialog.getByLabel('Client Name').fill(renamed);
    await dialog.getByLabel('Department').fill('Marketing');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole('row', { name: new RegExp(renamed) });
    await expect(row).toContainText('Marketing');
    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
  });

  test('deletes a client', async ({ page }) => {
    const name = uniqueName('Gamma');
    await createClient(page, name);

    acceptNextConfirm(page);
    await page.getByRole('row', { name: new RegExp(name) }).getByRole('button').last().click();

    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
    await expect(page.getByText('No clients found. Create your first client to get started.')).toBeVisible();
  });
});
