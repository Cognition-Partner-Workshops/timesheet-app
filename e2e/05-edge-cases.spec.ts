import { test, expect } from '@playwright/test';
import { login, resetBackend, apiCreateClient } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('should reject empty client name on create', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    // Leave name empty and try to submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open (form did not submit)
    await expect(page.getByText('Add New Client')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const specialName = "O'Brien & Co. <div>test</div>";
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Client should be created and displayed safely (React escapes HTML)
    await expect(page.getByRole('cell', { name: specialName })).toBeVisible({ timeout: 5000 });
  });

  test('should handle very long text in client description', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Long Desc Client');
    const longText = 'A'.repeat(500);
    await page.getByLabel('Description').fill(longText);
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: 'Long Desc Client' })).toBeVisible({ timeout: 5000 });
  });

  test('should reject work entry with no client selected', async ({ page }) => {
    await apiCreateClient('Some Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // Fill hours but leave client unselected
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error about selecting a client
    await expect(page.getByText(/select a client/i)).toBeVisible({ timeout: 5000 });
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    await apiCreateClient('Hours Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    await page.locator('.MuiDialog-root .MuiSelect-select').click();
    await page.getByRole('option', { name: 'Hours Client' }).click();
    await page.getByLabel('Hours').fill('0');
    await page.getByRole('button', { name: 'Create' }).click();

    // Browser HTML5 validation prevents form submit (min=0.01). Dialog stays open.
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await apiCreateClient('Special Desc Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    await page.locator('.MuiDialog-root .MuiSelect-select').click();
    await page.getByRole('option', { name: 'Special Desc Client' }).click();
    await page.getByLabel('Hours').fill('1');

    const specialDesc = "Code review: <div>test</div> & 'fixes' \"bugs\"";
    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(specialDesc)).toBeVisible({ timeout: 5000 });
  });

  test('should reject description exceeding max length', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Overflow Client');
    const veryLong = 'B'.repeat(1001);
    await page.getByLabel('Description').fill(veryLong);
    await page.getByRole('button', { name: 'Create' }).click();

    // Backend validates max 1000 chars; dialog stays open and error shows behind it
    await page.waitForTimeout(2000);
    await expect(page.getByText('Add New Client')).toBeVisible();
    // Client should NOT have been created
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('cell', { name: 'Overflow Client' })).not.toBeVisible({ timeout: 3000 });
  });
});
