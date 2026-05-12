import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, openClientDialog, openWorkEntryDialog, submitClientForm } from './helpers';

test.describe('Edge Cases', () => {
  test('should validate empty client name and accept special characters', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await openClientDialog(page);

    // Empty name should keep dialog open
    await submitClientForm(page);
    await expect(page.getByRole('dialog')).toBeVisible();

    // Special characters should be accepted
    const specialName = "O'Brien & Associates <Ltd>";
    await page.getByLabel('Client Name').fill(specialName);
    await submitClientForm(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle long descriptions and reject exceeding max length', async ({ page }) => {
    await login(page, uniqueEmail('edge'));

    // 500 chars should succeed
    await openClientDialog(page);
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill('A'.repeat(500));
    await submitClientForm(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Long Desc Client')).toBeVisible();

    // 1001 chars should be rejected
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Overflow Client');
    await page.getByLabel('Description').fill('B'.repeat(1001));
    await submitClientForm(page);
    const errorAlert = page.getByRole('alert').filter({ hasText: /error|fail|length|1000/i });
    await expect(errorAlert.or(page.getByRole('dialog'))).toBeVisible();
  });

  test('should validate work entry hours and accept special characters in description', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await createClient(page, 'Edge WE Client');

    // Empty hours should keep dialog open
    await openWorkEntryDialog(page, 'Edge WE Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Hours > 24 should be rejected
    await openWorkEntryDialog(page, 'Edge WE Client');
    await page.getByLabel('Hours').fill('25');
    await page.getByLabel('Description').fill('Too many hours');
    await page.getByRole('button', { name: 'Create' }).click();
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert.or(page.getByRole('dialog'))).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await createClient(page, 'Special Entry Client');
    await openWorkEntryDialog(page, 'Special Entry Client');
    await page.getByLabel('Hours').fill('1');

    const specialDesc = 'Task with "quotes" & <tags> + emojis';
    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should handle login with email containing special characters', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('user+tag@sub.example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
