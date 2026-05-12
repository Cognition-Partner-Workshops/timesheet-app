import { test, expect } from '@playwright/test';
import { login, deleteAllClients, createClient, navigateTo } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
  });

  test('should reject empty client name', async ({ page }) => {
    await navigateTo(page, '/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible({ timeout: 3000 });
  });

  test('should handle special characters in client name', async ({ page }) => {
    await createClient(page, 'Café & Résumé <test>');
    await expect(page.getByText('Café & Résumé')).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    await createClient(page, 'Long Description Client', { description: 'A'.repeat(500) });
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await createClient(page, 'Edge Case Client');
    await navigateTo(page, '/work-entries');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Edge Case Client' }).click();
    await page.getByLabel('Hours').fill('1');
    await page.getByLabel('Description').fill('Tëst with spëcial chars: €£¥ & "quotes"');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(/Tëst with spëcial chars/)).toBeVisible({ timeout: 5000 });
  });

  test('should not allow work entry without selecting a client', async ({ page }) => {
    await createClient(page, 'Dummy Client');
    await navigateTo(page, '/work-entries');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Please select a client')).toBeVisible({ timeout: 5000 });
  });

  test('should handle login with empty email submission prevented', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });
});
