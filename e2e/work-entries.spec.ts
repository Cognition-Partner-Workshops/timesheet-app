import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';

test.describe('Work Entries Workflow', () => {
  const uniqueId = Date.now().toString();
  const CLIENT_NAME = `E2E Client ${uniqueId}`;
  const WORK_DESCRIPTION = `E2E work entry ${uniqueId}`;
  const WORK_HOURS = '4';
  const EDITED_DESCRIPTION = `E2E edited entry ${uniqueId}`;
  const EDITED_HOURS = '6';

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('full CRUD workflow: create client, create work entry, verify, edit, and delete', async ({ page }) => {
    // Step 1: Create a client first (required for work entries)
    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();

    const clientDialog = page.getByRole('dialog');
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel('Client Name').fill(CLIENT_NAME);
    await clientDialog.getByRole('button', { name: 'Create' }).click();
    await expect(clientDialog).not.toBeVisible();

    // Verify client appears in the list
    await expect(page.getByRole('cell').getByText(CLIENT_NAME)).toBeVisible();

    // Step 2: Navigate to Work Entries and create a new work entry
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    const workDialog = page.getByRole('dialog');
    await expect(workDialog).toBeVisible();

    // Select the client from the MUI Select dropdown
    await workDialog.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Fill in hours
    await workDialog.getByLabel('Hours').fill(WORK_HOURS);

    // Fill in description
    await workDialog.getByLabel('Description').fill(WORK_DESCRIPTION);

    // Submit
    await workDialog.getByRole('button', { name: 'Create' }).click();
    await expect(workDialog).not.toBeVisible();

    // Step 3: Verify the work entry appears in the list
    const workEntryRow = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await expect(workEntryRow).toBeVisible();
    await expect(workEntryRow.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(workEntryRow.getByText(WORK_DESCRIPTION)).toBeVisible();

    // Step 4: Edit the work entry
    await workEntryRow.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByText('Edit Work Entry')).toBeVisible();

    // Update hours
    await editDialog.getByLabel('Hours').clear();
    await editDialog.getByLabel('Hours').fill(EDITED_HOURS);

    // Update description
    await editDialog.getByLabel('Description').clear();
    await editDialog.getByLabel('Description').fill(EDITED_DESCRIPTION);

    // Submit the edit
    await editDialog.getByRole('button', { name: 'Update' }).click();
    await expect(editDialog).not.toBeVisible();

    // Verify the updated values
    const updatedRow = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await expect(updatedRow.getByText(`${EDITED_HOURS} hours`)).toBeVisible();
    await expect(updatedRow.getByText(EDITED_DESCRIPTION)).toBeVisible();

    // Step 5: Delete the work entry
    page.on('dialog', dialog => dialog.accept());

    await updatedRow.locator('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    // Verify the work entry is removed
    await expect(page.getByText(EDITED_DESCRIPTION)).not.toBeVisible();
    await expect(page.getByText('No work entries found')).toBeVisible();
  });
});
