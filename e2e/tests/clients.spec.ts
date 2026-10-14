import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient } from './helpers';

test.describe('Client management', () => {
  test('create, edit, and delete a client', async ({ page }) => {
    await login(page, uniqueEmail('clients'));

    await createClient(page, 'Acme Corp', {
      department: 'Engineering',
      email: 'contact@acme.com',
      description: 'Primary client',
    });
    const row = page.getByRole('row', { name: /Acme Corp/ });
    await expect(row).toContainText('Engineering');
    await expect(row).toContainText('contact@acme.com');
    await expect(row).toContainText('Primary client');

    await row.getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Edit Client')).toBeVisible();
    await dialog.getByLabel('Client Name').fill('Acme Corporation');
    await dialog.getByLabel('Department').fill('Product');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
    const updatedRow = page.getByRole('row', { name: /Acme Corporation/ });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText('Product');

    page.once('dialog', (d) => d.accept());
    await updatedRow.getByRole('button').nth(1).click();
    await expect(page.getByRole('cell', { name: 'Acme Corporation', exact: true })).toBeHidden();
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});
