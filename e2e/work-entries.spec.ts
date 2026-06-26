import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'E2E Test Client';
const API_URL = 'http://localhost:3001';

test.describe('Work Entries Workflow', () => {
  test.beforeEach(async ({ page, request }) => {
    // Ensure clean state via API
    await request.post(`${API_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL },
    });
    // Delete all clients (and associated work entries via cascade or manual cleanup)
    await request.delete(`${API_URL}/api/clients`, {
      headers: { 'x-user-email': TEST_EMAIL },
    });
    // Also delete any orphaned work entries directly
    const entriesResp = await request.get(`${API_URL}/api/work-entries`, {
      headers: { 'x-user-email': TEST_EMAIL },
    });
    if (entriesResp.ok()) {
      const entries = (await entriesResp.json()).workEntries || [];
      for (const entry of entries) {
        await request.delete(`${API_URL}/api/work-entries/${entry.id}`, {
          headers: { 'x-user-email': TEST_EMAIL },
        });
      }
    }

    // Login via UI
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/dashboard');
  });

  test('full CRUD lifecycle: create, verify, edit, and delete a work entry', async ({ page }) => {
    // Step 1: Create a client (prerequisite for work entries)
    await page.getByRole('navigation').getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');

    await page.getByRole('button', { name: /add client/i }).click();
    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Description').fill('Client for E2E testing');
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify client appears in the list
    await expect(page.getByRole('cell', { name: CLIENT_NAME }).first()).toBeVisible();

    // Step 2: Navigate to Work Entries page
    await page.getByRole('navigation').getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    // Step 3: Create a work entry
    await page.getByRole('main').getByRole('button', { name: /add work entry/i }).click();

    // Wait for dialog to appear
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select client from the MUI Select dropdown
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Fill in hours
    await page.getByLabel('Hours').fill('4.5');

    // Fill in description
    await page.getByLabel('Description').fill('Initial E2E test entry');

    // Submit the form and wait for network response
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/work-entries') && resp.status() === 201),
      page.getByRole('button', { name: 'Create' }).click(),
    ]);

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).toBeHidden();

    // Step 4: Verify the work entry appears in the list
    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByText('Initial E2E test entry')).toBeVisible();

    // Step 5: Edit the work entry
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();

    // Wait for edit dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /edit work entry/i })).toBeVisible();

    // Update the hours and description
    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill('6');

    const descriptionField = page.getByLabel('Description');
    await descriptionField.clear();
    await descriptionField.fill('Updated E2E test entry');

    // Submit the edit and wait for network response
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/work-entries') && resp.status() === 200),
      page.getByRole('button', { name: 'Update' }).click(),
    ]);

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).toBeHidden();

    // Verify the updated values
    await expect(page.getByText('6 hours')).toBeVisible();
    await expect(page.getByText('Updated E2E test entry')).toBeVisible();
    await expect(page.getByText('4.5 hours')).toBeHidden();

    // Step 6: Delete the work entry
    page.on('dialog', (dialog) => dialog.accept());
    const updatedRow = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/work-entries') && resp.request().method() === 'DELETE'),
      updatedRow.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click(),
    ]);

    // Verify entry is removed
    await expect(page.getByText('Updated E2E test entry')).toBeHidden();
    await expect(page.getByText('No work entries found')).toBeVisible();
  });
});
