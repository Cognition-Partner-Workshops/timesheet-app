import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should reject empty client name submission', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    // Try to submit with empty name
    await page.getByLabel('Client Name').fill('');
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open - form validation prevents submission
    await expect(page.getByText('Add New Client')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const specialName = 'Tëst & Co. <b>bold</b>';
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // The name should be displayed correctly (escaped, not executed)
    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const longText = 'A'.repeat(500);
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill(longText);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    // Ensure a client exists
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
    const tableText = await page.locator('table').textContent().catch(() => '');
    if (tableText?.includes('No clients found')) {
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client Name').fill('Edge Case Client');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('0');
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open - browser native validation prevents submission
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
  });

  test('should reject work entry without selecting a client', async ({ page }) => {
    // Ensure a client exists
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
    const tableText = await page.locator('table').textContent().catch(() => '');
    if (tableText?.includes('No clients found')) {
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client Name').fill('Edge Case Client 2');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    // Don't select a client
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('alert').or(page.getByText(/select a client/i))).toBeVisible({ timeout: 3000 });
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    // Ensure a client exists
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
    const tableText = await page.locator('table').textContent().catch(() => '');
    if (tableText?.includes('No clients found')) {
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client Name').fill('Special Chars Client');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('1');

    const specialDesc = '日本語テスト & "quotes" <tags> $pecial!';
    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should reject hours greater than 24', async ({ page }) => {
    // Ensure a client exists
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).waitFor({ timeout: 5000 });
    const tableText = await page.locator('table').textContent().catch(() => '');
    if (tableText?.includes('No clients found')) {
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client Name').fill('Hours Limit Client');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    }

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Hours').fill('25');
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open - browser native validation prevents submission
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
  });
});
