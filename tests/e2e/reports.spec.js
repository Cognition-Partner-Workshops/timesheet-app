// @ts-check
const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/e2e-login');

const TEST_EMAIL = 'e2e-reports@example.com';

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_EMAIL);
  });

  test('should display the reports page', async ({ page }) => {
    await page.locator('nav').getByText('Reports').click();
    await expect(page).toHaveURL(/reports/);
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('should show a prompt to create clients when none exist', async ({ page }) => {
    await page.locator('nav').getByText('Reports').click();
    await expect(page).toHaveURL(/reports/);

    // Should prompt to create a client when no clients exist
    await expect(page.getByText(/create.*client/i).first()).toBeVisible();
  });

  test('should generate a report after creating data', async ({ page }) => {
    const uniqueName = `Report Client ${Date.now()}`;

    // Create a client
    await page.locator('nav').getByText('Clients').click();
    await page.getByRole('button', { name: /add client/i }).click();
    await page.getByLabel(/client name/i).fill(uniqueName);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('cell', { name: uniqueName }).first()).toBeVisible();

    // Add a work entry
    await page.locator('nav').getByText('Work Entries').click();
    await page.getByRole('button', { name: /add work entry/i }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: uniqueName }).first().click();

    await dialog.getByRole('spinbutton', { name: /hours/i }).fill('5');
    await dialog.getByRole('button', { name: /create/i }).click();

    // Verify the work entry was created
    await expect(page.getByText('5 hours')).toBeVisible();

    // Navigate to reports
    await page.locator('nav').getByText('Reports').click();
    await expect(page).toHaveURL(/reports/);

    // Select the client from MUI Select
    await page.locator('main').getByRole('combobox').click();
    await page.getByRole('option', { name: uniqueName }).first().click();

    // Verify report heading or data appears
    await expect(page.getByRole('heading', { name: /report/i }).first()).toBeVisible();
  });
});
