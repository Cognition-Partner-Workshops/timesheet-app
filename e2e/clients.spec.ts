import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-clients-${Date.now()}@example.com`;
const CLIENT_NAME_UPDATED = 'Acme Corp International';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('should create a new client', async ({ page }) => {
    const clientName = `Create Client ${Date.now()}`;

    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Add Client' }).click();

    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
    await page.getByLabel('Client Name').fill(clientName);
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Description').fill('A major technology client');
    await page.screenshot({ path: 'e2e/screenshots/clients-01-create-form.png' });

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(clientName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Engineering')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/clients-02-client-created.png' });
  });

  test('should edit a client name and verify the update persists', async ({ page }) => {
    const uniqueClientName = `Edit Client ${Date.now()}`;

    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible({ timeout: 15000 });

    // Create a client with a unique name
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
    await page.getByLabel('Client Name').fill(uniqueClientName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(uniqueClientName)).toBeVisible({ timeout: 15000 });

    // Find the row containing our client and click its edit button
    const clientRow = page.locator('tr', { hasText: uniqueClientName });
    await clientRow.locator('button:has([data-testid="EditIcon"])').click();

    // Verify edit dialog opens
    await expect(page.getByRole('heading', { name: 'Edit Client' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/clients-03-edit-dialog.png' });

    // Clear and update the name
    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill(CLIENT_NAME_UPDATED);
    await page.getByRole('button', { name: 'Update' }).click();

    // Verify the updated name is displayed
    await expect(page.getByText(CLIENT_NAME_UPDATED)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(uniqueClientName)).not.toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/clients-04-client-updated.png' });

    // Reload the page and verify the update persists
    await page.reload();
    await expect(page.getByText(CLIENT_NAME_UPDATED)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/clients-05-update-persisted.png' });
  });
});
