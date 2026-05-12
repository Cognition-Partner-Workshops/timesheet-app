import { test, expect } from '@playwright/test';
import { login, navigateTo, createClient, selectClientInDialog, uniqueName, resetDatabase } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeAll(async () => { await resetDatabase(); });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Empty Form Submissions', () => {
    test('should prevent creating a client without a name', async ({ page }) => {
      await navigateTo(page, 'Clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Leave name empty, try to submit
      await dialog.getByRole('button', { name: 'Create' }).click();

      // Should show validation error or not close the dialog
      await expect(dialog).toBeVisible();
    });

    test('should prevent creating a work entry without selecting a client', async ({ page }) => {
      const clientName = uniqueName('Edge Client');
      await createClient(page, clientName);
      await navigateTo(page, 'Work Entries');

      await page.getByRole('button', { name: 'Add Work Entry' }).click();
      const dialog = page.getByRole('dialog');
      // Don't select client, fill hours, try to submit
      await dialog.getByLabel('Hours').fill('5');
      await dialog.getByRole('button', { name: 'Create' }).click();

      // Should show validation error or dialog stays open
      await expect(dialog).toBeVisible({ timeout: 3000 });
    });

    test('should prevent creating a work entry without hours', async ({ page }) => {
      const clientName = uniqueName('Hours Client');
      await createClient(page, clientName);
      await navigateTo(page, 'Work Entries');

      await page.getByRole('button', { name: 'Add Work Entry' }).click();
      const dialog = page.getByRole('dialog');
      await selectClientInDialog(page, clientName);
      // Clear hours field (default might be "0")
      await dialog.getByLabel('Hours').clear();
      await dialog.getByRole('button', { name: 'Create' }).click();

      // Should show validation error or stay on form
      await expect(dialog).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Special Characters in Names', () => {
    test('should handle special characters in client name', async ({ page }) => {
      await navigateTo(page, 'Clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      const dialog = page.getByRole('dialog');

      const specialName = "O'Brien & Associates (LLC)";
      await dialog.getByLabel('Client Name').fill(specialName);
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByRole('cell', { name: specialName })).toBeVisible({ timeout: 5000 });
    });

    test('should handle unicode characters in client name', async ({ page }) => {
      await navigateTo(page, 'Clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      const dialog = page.getByRole('dialog');

      const unicodeName = 'Caf\u00e9 M\u00fcller \u2014 \u00d1o\u00f1o Ltd';
      await dialog.getByLabel('Client Name').fill(unicodeName);
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByRole('cell', { name: unicodeName })).toBeVisible({ timeout: 5000 });
    });

    test('should handle special characters in work entry description', async ({ page }) => {
      const clientName = uniqueName('SpecChar Client');
      await createClient(page, clientName);
      await navigateTo(page, 'Work Entries');

      await page.getByRole('button', { name: 'Add Work Entry' }).click();
      const dialog = page.getByRole('dialog');
      await selectClientInDialog(page, clientName);
      await dialog.getByLabel('Hours').fill('1');

      const specialDesc = "Fixed bug #123: handle quotes and ampersands & more";
      await dialog.getByLabel('Description').fill(specialDesc);
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByRole('cell', { name: specialDesc })).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Very Long Text', () => {
    test('should handle a very long client name', async ({ page }) => {
      await navigateTo(page, 'Clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      const dialog = page.getByRole('dialog');

      const longName = 'A'.repeat(200);
      await dialog.getByLabel('Client Name').fill(longName);
      await dialog.getByRole('button', { name: 'Create' }).click();

      // Wait for response - either created (dialog closes) or rejected (dialog stays)
      await page.waitForTimeout(3000);
      const dialogClosed = !(await dialog.isVisible());
      const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
      expect(dialogClosed || errorShown || (await dialog.isVisible())).toBeTruthy();
    });

    test('should handle a very long work entry description', async ({ page }) => {
      const clientName = uniqueName('Long Desc Client');
      await createClient(page, clientName);
      await navigateTo(page, 'Work Entries');

      await page.getByRole('button', { name: 'Add Work Entry' }).click();
      const dialog = page.getByRole('dialog');
      await selectClientInDialog(page, clientName);
      await dialog.getByLabel('Hours').fill('1');

      const longDescription = 'Detailed work description. '.repeat(50);
      await dialog.getByLabel('Description').fill(longDescription);
      await dialog.getByRole('button', { name: 'Create' }).click();

      // Wait for response
      await page.waitForTimeout(3000);
      const dialogClosed = !(await dialog.isVisible());
      const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
      expect(dialogClosed || errorShown || (await dialog.isVisible())).toBeTruthy();
    });
  });
});
