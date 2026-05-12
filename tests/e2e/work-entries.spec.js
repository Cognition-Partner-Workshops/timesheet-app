// @ts-check
const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/e2e-login');

const TEST_EMAIL = 'e2e-entries@example.com';

test.describe('Work Entries Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_EMAIL);
  });

  test('should display work entries page', async ({ page }) => {
    await page.locator('nav').getByText('Work Entries').click();
    await expect(page).toHaveURL(/work-entries/);
    await expect(page.getByRole('heading', { name: /work entries/i })).toBeVisible();
  });

  test('should create a client and then a work entry', async ({ page }) => {
    // Create a client first
    await page.locator('nav').getByText('Clients').click();
    await expect(page).toHaveURL(/clients/);

    await page.getByRole('button', { name: /add client/i }).click();
    await page.getByLabel(/client name/i).fill('Work Entry Test Client');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('cell', { name: 'Work Entry Test Client' }).first()).toBeVisible();

    // Navigate to work entries
    await page.locator('nav').getByText('Work Entries').click();
    await expect(page).toHaveURL(/work-entries/);

    // Add a work entry
    await page.getByRole('button', { name: /add work entry/i }).click();

    // Select the client from the MUI Select dropdown
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: /work entry test client/i }).click();

    // Fill hours
    await dialog.getByRole('spinbutton', { name: /hours/i }).fill('4.5');

    // Fill description
    await dialog.getByRole('textbox', { name: /description/i }).fill('E2E test work entry');

    // Submit
    await dialog.getByRole('button', { name: /create/i }).click();

    // Verify the entry appears in the table
    await expect(page.getByText('4.5 hours')).toBeVisible();
  });
});
