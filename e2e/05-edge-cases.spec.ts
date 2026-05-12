import { test, expect } from '@playwright/test';
import { login, deleteAllClients } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await deleteAllClients(page);
  });

  test('should reject empty client name', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Client' }).click();

    // Leave name empty, click Create
    await page.getByRole('button', { name: 'Create' }).click();

    // The dialog should remain open with the Client Name field still visible
    // HTML5 required attribute should prevent submission
    await expect(page.getByText('Add New Client')).toBeVisible({ timeout: 3000 });
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Client' }).click();

    const specialName = 'Café & Résumé <test>';
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Café & Résumé')).toBeVisible({ timeout: 5000 });
  });

  test('should handle very long text in client description', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Long Description Client');
    const longText = 'A'.repeat(500);
    await page.getByLabel('Description').fill(longText);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Long Description Client')).toBeVisible({ timeout: 5000 });
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    // Create a client first
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Edge Case Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Edge Case Client')).toBeVisible({ timeout: 5000 });

    // Create work entry with special characters
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Edge Case Client' }).click();
    await page.getByLabel('Hours').fill('1');
    await page.getByLabel('Description').fill('Tëst with spëcial chars: €£¥ & "quotes"');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(/Tëst with spëcial chars/)).toBeVisible({ timeout: 5000 });
  });

  test('should not allow work entry without selecting a client', async ({ page }) => {
    // Create a client first so the form is accessible
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Dummy Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Dummy Client')).toBeVisible({ timeout: 5000 });

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    // Don't select a client, fill hours and try to save
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show the "Please select a client" validation error
    await expect(page.getByText('Please select a client')).toBeVisible({ timeout: 5000 });
  });

  test('should handle login with empty email submission prevented', async ({ page }) => {
    await page.goto('/login');
    const loginBtn = page.getByRole('button', { name: 'Log In' });
    await expect(loginBtn).toBeDisabled();
  });
});
