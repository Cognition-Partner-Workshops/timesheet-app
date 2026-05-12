import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, openWorkEntryDialog } from './helpers';

test.describe('Edge Cases', () => {
  test('should show validation error when submitting client form with empty name', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const specialName = "O'Brien & Associates <Ltd>";
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill('A'.repeat(500));
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject description exceeding max length', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Overflow Client');
    await page.getByLabel('Description').fill('B'.repeat(1001));
    await page.getByRole('button', { name: 'Create' }).click();

    const errorAlert = page.getByRole('alert').filter({ hasText: /error|fail|length|1000/i });
    await expect(errorAlert.or(page.getByRole('dialog'))).toBeVisible();
  });

  test('should show validation error for work entry with empty hours', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await createClient(page, 'Hours Edge Client');
    await openWorkEntryDialog(page, 'Hours Edge Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
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

  test('should reject work entry with hours > 24', async ({ page }) => {
    await login(page, uniqueEmail('edge'));
    await createClient(page, 'Max Hours Client');
    await openWorkEntryDialog(page, 'Max Hours Client');
    await page.getByLabel('Hours').fill('25');
    await page.getByLabel('Description').fill('Too many hours');
    await page.getByRole('button', { name: 'Create' }).click();

    const errorAlert = page.getByRole('alert');
    await expect(errorAlert.or(page.getByRole('dialog'))).toBeVisible();
  });

  test('should handle login with email containing special characters', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('user+tag@sub.example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
