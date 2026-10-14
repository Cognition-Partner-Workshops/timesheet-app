import { test, expect } from '@playwright/test';
import {
  resetTestState, createClient, openClientDialog, fillClientForm,
  navigateToWorkEntries, openWorkEntryDialog, fillWorkEntry, createWorkEntry,
} from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('should reject empty client name', async ({ page }) => {
    await openClientDialog(page);
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
    await openClientDialog(page);
    await fillClientForm(page, 'Long Desc Client', { description: 'A'.repeat(999) });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject description exceeding max length', async ({ page }) => {
    await openClientDialog(page);
    await fillClientForm(page, 'Over Limit Client', { description: 'B'.repeat(1001) });
    await page.getByRole('button', { name: 'Create' }).click();

    const dialogStillOpen = await page.getByRole('dialog').isVisible();
    const errorVisible = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorVisible).toBeTruthy();
  });

  for (const { hours, label } of [
    { hours: '0', label: 'zero hours' },
    { hours: '25', label: 'hours exceeding 24' },
  ]) {
    test(`should reject work entry with ${label}`, async ({ page }) => {
      await createClient(page, 'Hours Validation Client');
      await navigateToWorkEntries(page);
      await openWorkEntryDialog(page);
      await fillWorkEntry(page, 'Hours Validation Client', hours, `Test ${label}`);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }

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
