import { test, expect } from '@playwright/test';
import {
  login, clearAllClients, createClient, setupDialogHandler,
  navigateToWorkEntries, openWorkEntryDialog, fillWorkEntry, createWorkEntry,
} from './helpers';

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

    await page.getByLabel('Client Name').fill('');
    await page.getByRole('button', { name: 'Create' }).click();

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

    const dialogStillOpen = await page.getByRole('dialog').isVisible();
    const errorVisible = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorVisible).toBeTruthy();
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    await createClient(page, 'Hours Edge Client');
    await navigateToWorkEntries(page);
    await openWorkEntryDialog(page);
    await fillWorkEntry(page, 'Hours Edge Client', '0', 'Zero hours test');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should reject work entry with hours exceeding 24', async ({ page }) => {
    await createClient(page, 'Max Hours Client');
    await navigateToWorkEntries(page);
    await openWorkEntryDialog(page);
    await fillWorkEntry(page, 'Max Hours Client', '25', 'Over 24 hours test');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await createClient(page, 'Special Char Client');
    await navigateToWorkEntries(page);
    await createWorkEntry(
      page, 'Special Char Client', '1',
      '<script>alert("xss")</script> & "quotes" \'apostrophe\''
    );

    await expect(page.getByText('<script>alert("xss")</script>')).toBeVisible();
  });

  test('should not submit work entry without selecting a client', async ({ page }) => {
    await createClient(page, 'Unused Client');
    await navigateToWorkEntries(page);
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
