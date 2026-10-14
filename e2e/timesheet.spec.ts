import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';

test.describe('Timesheet App E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('should login and see dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should navigate to clients and manage a client', async ({ page }) => {
    // Accept all confirm dialogs (clear all, delete)
    page.on('dialog', dialog => dialog.accept());

    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');
    await expect(page.getByRole('heading', { name: 'Clients', level: 4 })).toBeVisible();

    // Clear existing clients first to avoid duplicates
    const clearBtn = page.getByRole('button', { name: /clear all/i });
    if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(1000);
    }

    // Open the Add Client dialog and create a client
    await page.getByRole('button', { name: /add client/i }).click();
    await expect(page.getByLabel('Client Name')).toBeVisible({ timeout: 5000 });
    await page.getByLabel('Client Name').fill('Playwright Client');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByRole('button', { name: /create/i }).click();

    // Verify client appears in table
    await expect(page.getByRole('cell', { name: 'Playwright Client' })).toBeVisible();

    // Delete the client we created
    const row = page.getByRole('row', { name: /Playwright Client/ });
    await row.getByRole('button').last().click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('cell', { name: 'Playwright Client' })).not.toBeVisible();
  });

  test('should navigate to work entries page', async ({ page }) => {
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries', level: 4 })).toBeVisible();
  });

  test('should navigate to reports page', async ({ page }) => {
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('should logout and redirect to login', async ({ page }) => {
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
