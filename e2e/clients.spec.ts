import { test, expect } from '@playwright/test';
import { login, createClient, deleteAllClients, deleteAllWorkEntries } from './helpers';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'client-test@example.com');
    // Clean up any existing data
    await deleteAllWorkEntries(page);
    await deleteAllClients(page);
  });

  test('should create a new client with name, email, and description', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in client details
    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@example.com');
    await page.getByLabel('Description').fill('Test client for E2E');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify client appears in the list
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('acme@example.com')).toBeVisible();
    await expect(page.getByText('Test client for E2E')).toBeVisible();
  });

  test('should verify the client appears in the client list', async ({ page }) => {
    // Create a client first
    await createClient(page, {
      name: 'Visible Client',
      department: 'Sales',
      email: 'visible@example.com',
    });

    await page.goto('/clients');
    // The client table should show the new client
    const row = page.locator('tr', { hasText: 'Visible Client' });
    await expect(row).toBeVisible();
    await expect(row.getByText('Sales')).toBeVisible();
    await expect(row.getByText('visible@example.com')).toBeVisible();
  });

  test('should edit a client name and email', async ({ page }) => {
    // Create a client to edit
    await createClient(page, {
      name: 'Original Name',
      email: 'original@example.com',
    });

    await page.goto('/clients');
    // Click the edit button on the client row
    const row = page.locator('tr', { hasText: 'Original Name' });
    await row.getByRole('button', { name: 'Edit' }).or(row.locator('[data-testid="EditIcon"]').locator('..')).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Update name and email
    const nameField = page.getByLabel('Client Name');
    await nameField.clear();
    await nameField.fill('Updated Name');

    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill('updated@example.com');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify updated info is displayed
    await expect(page.getByText('Updated Name')).toBeVisible();
    await expect(page.getByText('updated@example.com')).toBeVisible();
    // Original info should not be visible
    await expect(page.getByText('Original Name')).not.toBeVisible();
  });

  test('should show validation when creating a client with empty name', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Try to submit with empty name — the field is required
    // Clear the name field and try to submit
    await page.getByLabel('Client Name').fill('');

    // Click Create button
    await page.getByRole('button', { name: 'Create' }).click();

    // The dialog should still be open (form not submitted)
    // Browser validation or app validation should prevent submission
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should delete a client and verify removal from list', async ({ page }) => {
    // Create a client to delete
    await createClient(page, {
      name: 'Client To Delete',
      email: 'delete@example.com',
    });

    await page.goto('/clients');
    await expect(page.getByText('Client To Delete')).toBeVisible();

    // Handle the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button
    const row = page.locator('tr', { hasText: 'Client To Delete' });
    await row.locator('[data-testid="DeleteIcon"]').locator('..').first().click();

    // Verify client is removed
    await expect(page.getByText('Client To Delete')).not.toBeVisible({ timeout: 10000 });
  });

  test('should handle creating a client with duplicate name', async ({ page }) => {
    // Create a client
    await createClient(page, {
      name: 'Duplicate Client',
      email: 'dup1@example.com',
    });

    // Try to create another client with the same name
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').fill('Duplicate Client');
    await page.getByLabel('Email').fill('dup2@example.com');
    await page.getByRole('button', { name: 'Create' }).click();

    // The app may allow duplicate names (no unique constraint on name).
    // Wait for dialog to close which means the duplicate was created successfully.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Both clients should appear in the list
    const rows = page.locator('tr', { hasText: 'Duplicate Client' });
    await expect(rows).toHaveCount(2);
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/clients');
    await expect(
      page.getByText('No clients found. Create your first client to get started.'),
    ).toBeVisible();
  });
});
