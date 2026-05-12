// @ts-check
const { test, expect } = require('@playwright/test');

const TEST_EMAIL = 'e2e-clients@example.com';

/** Login and go to the Clients page. */
async function loginAndGoToClients(page) {
  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(TEST_EMAIL);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/dashboard/);

  // Navigate via sidebar
  await page.locator('nav').getByText('Clients').click();
  await expect(page).toHaveURL(/clients/);
}

test.describe('Clients Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToClients(page);
  });

  test('should display the clients page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add client/i })).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    await page.getByRole('button', { name: /add client/i }).click();

    // Fill the dialog form
    await page.getByLabel(/client name/i).fill('E2E Test Client');
    await page.getByLabel(/department/i).fill('QA');
    await page.getByLabel(/^email$/i).fill('e2e@client.com');
    await page.getByLabel(/description/i).fill('Created by E2E test');

    await page.getByRole('button', { name: /create/i }).click();

    // Verify the client appears in the table
    await expect(page.getByRole('cell', { name: 'E2E Test Client' })).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    // First create a client
    await page.getByRole('button', { name: /add client/i }).click();
    await page.getByLabel(/client name/i).fill('Client To Edit');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('cell', { name: 'Client To Edit' })).toBeVisible();

    // Click the edit button in the row
    const row = page.getByRole('row', { name: /client to edit/i });
    await row.getByRole('button').first().click();

    // Update the name
    const nameField = page.getByLabel(/client name/i);
    await nameField.clear();
    await nameField.fill('Client Edited');

    await page.getByRole('button', { name: /update/i }).click();

    await expect(page.getByRole('cell', { name: 'Client Edited' })).toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    // Create a client
    await page.getByRole('button', { name: /add client/i }).click();
    await page.getByLabel(/client name/i).fill('Client To Delete');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('cell', { name: 'Client To Delete' })).toBeVisible();

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button (2nd button in row actions)
    const row = page.getByRole('row', { name: /client to delete/i });
    await row.getByRole('button').last().click();

    // Verify the client is removed
    await expect(page.getByRole('cell', { name: 'Client To Delete' })).not.toBeVisible();
  });
});
