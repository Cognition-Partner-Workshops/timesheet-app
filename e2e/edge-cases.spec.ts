import { test, expect } from '@playwright/test';

const uniqueEmail = () => `edge-${Date.now()}@example.com`;

test.describe('Edge Cases', () => {
  test('should show validation error when submitting client form with empty name', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Leave name empty and try to submit
    await page.getByRole('button', { name: 'Create' }).click();

    // The form should still be open with a validation error
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const specialName = "O'Brien & Associates <Ltd>";
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Long Desc Client');
    const longDesc = 'A'.repeat(500);
    await page.getByLabel('Description').fill(longDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject description exceeding max length', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    await page.getByLabel('Client Name').fill('Overflow Client');
    const tooLongDesc = 'B'.repeat(1001);
    await page.getByLabel('Description').fill(tooLongDesc);
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error or dialog should remain open
    const errorAlert = page.getByRole('alert').filter({ hasText: /error|fail|length|1000/i });
    const dialogVisible = page.getByRole('dialog');
    await expect(errorAlert.or(dialogVisible)).toBeVisible();
  });

  test('should show validation error for work entry with empty hours', async ({ page }) => {
    await page.goto('/login');
    const email = uniqueEmail();
    await page.getByLabel('Email Address').fill(email);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Create a client first
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Hours Edge Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'Hours Edge Client' }).click();

    // Leave hours empty and submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open (form not submitted due to validation)
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await page.goto('/login');
    const email = uniqueEmail();
    await page.getByLabel('Email Address').fill(email);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Special Entry Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'Special Entry Client' }).click();
    await page.getByLabel('Hours').fill('1');

    const specialDesc = 'Task with "quotes" & <tags> + emojis';
    await page.getByLabel('Description').fill(specialDesc);

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should reject work entry with hours > 24', async ({ page }) => {
    await page.goto('/login');
    const email = uniqueEmail();
    await page.getByLabel('Email Address').fill(email);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Max Hours Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'Max Hours Client' }).click();
    await page.getByLabel('Hours').fill('25');
    await page.getByLabel('Description').fill('Too many hours');

    await page.getByRole('button', { name: 'Create' }).click();

    // Should show validation error or dialog remains open
    const errorAlert = page.getByRole('alert');
    const dialogStillOpen = page.getByRole('dialog');
    await expect(errorAlert.or(dialogStillOpen)).toBeVisible();
  });

  test('should handle login with email containing special characters', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('user+tag@sub.example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
