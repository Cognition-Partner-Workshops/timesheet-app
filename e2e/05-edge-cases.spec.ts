import { test, expect } from '@playwright/test';
import { login, clearAllClients, createClient, setupDialogHandler } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    setupDialogHandler(page);
    await login(page);
    await clearAllClients(page);
  });

  test('should reject empty client name', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameField = page.getByLabel('Client Name');
    await nameField.fill('');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should still be on the dialog (not submitted)
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    const specialName = 'O\'Brien & Associates <LLC> "Test"';
    await createClient(page, specialName);
    await page.goto('/clients');
    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    const longDesc = 'A'.repeat(999);
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill(longDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject description exceeding max length', async ({ page }) => {
    const tooLong = 'B'.repeat(1001);
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Over Limit Client');
    await page.getByLabel('Description').fill(tooLong);
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error or dialog stays open
    const dialogStillOpen = await page.getByRole('dialog').isVisible();
    const errorVisible = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorVisible).toBeTruthy();
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    await createClient(page, 'Hours Edge Client');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Hours Edge Client' }).click();
    await page.getByLabel('Hours').fill('0');
    await page.getByLabel('Description').fill('Zero hours test');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error about hours — dialog stays open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should reject work entry with hours exceeding 24', async ({ page }) => {
    await createClient(page, 'Max Hours Client');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Max Hours Client' }).click();
    await page.getByLabel('Hours').fill('25');
    await page.getByLabel('Description').fill('Over 24 hours test');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show validation error — dialog stays open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await createClient(page, 'Special Char Client');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Special Char Client' }).click();
    await page.getByLabel('Hours').fill('1');
    await page.getByLabel('Description').fill('<script>alert("xss")</script> & "quotes" \'apostrophe\'');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('<script>alert("xss")</script>')).toBeVisible();
  });

  test('should not submit work entry without selecting a client', async ({ page }) => {
    await createClient(page, 'Unused Client');
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    // Don't select a client
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error or dialog stays open
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
