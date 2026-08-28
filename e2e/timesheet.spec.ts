import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';

/**
 * Helper: log in and wait for dashboard to load.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Navigate via the sidebar (permanent drawer) using the list-item text.
 */
async function navigateTo(page: import('@playwright/test').Page, name: string, urlPart: string) {
  await page.locator('nav').getByText(name, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(urlPart));
}

test.describe.serial('Timesheet App E2E Tests', () => {
  // ---- Workflow 1: Login flow ----
  test('1. Login flow - should log in with email', async ({ page }) => {
    await page.goto('/login');

    // Verify login page elements
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    // Fill in email and submit
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    // Verify user email is displayed in the header
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  // ---- Workflow 2: Create a client ----
  test('2. Create a client', async ({ page }) => {
    await login(page);

    // Navigate to Clients page via sidebar
    await navigateTo(page, 'Clients', '/clients');
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();

    // Click "Add Client"
    await page.getByRole('button', { name: 'Add Client' }).click();

    // Fill out the form in the dialog
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
    await page.getByLabel('Client Name').fill('Acme Corporation');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Description').fill('Main consulting client');

    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the client appears in the table
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Acme Corporation')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('contact@acme.com')).toBeVisible();
    await expect(page.getByText('Main consulting client')).toBeVisible();
  });

  // ---- Workflow 3: Create a work entry for that client ----
  test('3. Create a work entry for the client', async ({ page }) => {
    await login(page);

    // Navigate to Work Entries page via sidebar
    await navigateTo(page, 'Work Entries', '/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries', exact: true })).toBeVisible();

    // Click "Add Work Entry"
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    // Select the client from dropdown (MUI Select: use locator for the select div)
    const dialog = page.getByRole('dialog', { name: 'Add New Work Entry' });
    await dialog.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    // Wait for the MUI Select popover/menu to fully close
    await expect(page.locator('.MuiPopover-root')).toBeHidden();

    // Fill in hours
    await dialog.getByLabel('Hours').fill('8');

    // Fill in description (before date to avoid date picker focus issues)
    await dialog.getByLabel('Description').fill('Backend API development');

    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the work entry appears in the table
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Acme Corporation')).toBeVisible();
    await expect(page.getByText('8 hours')).toBeVisible();
    await expect(page.getByText('Backend API development')).toBeVisible();
  });

  // ---- Workflow 4: Verify the work entry appears in the list ----
  test('4. Verify the work entry appears in the list', async ({ page }) => {
    await login(page);

    // Navigate to Work Entries page via sidebar
    await navigateTo(page, 'Work Entries', '/work-entries');

    // Verify the work entry is in the list
    await expect(page.getByText('Acme Corporation')).toBeVisible();
    await expect(page.getByText('8 hours')).toBeVisible();
    await expect(page.getByText('Backend API development')).toBeVisible();

    // Also verify on the dashboard
    await navigateTo(page, 'Dashboard', '/dashboard');

    // Dashboard should show updated stats
    await expect(page.getByText('1').first()).toBeVisible(); // 1 client
    await expect(page.getByText('8.00')).toBeVisible(); // 8 total hours
  });

  // ---- Workflow 5: Edit the work entry ----
  test('5. Edit the work entry', async ({ page }) => {
    await login(page);

    // Navigate to Work Entries page via sidebar
    await navigateTo(page, 'Work Entries', '/work-entries');

    // Click the edit button on the work entry row
    const entryRow = page.getByRole('row').filter({ hasText: 'Acme Corporation' });
    await entryRow.getByRole('button').first().click();

    // Verify the edit dialog opens with existing data
    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();

    // Update the hours (wait for dialog to be ready)
    const editDialog = page.getByRole('dialog', { name: 'Edit Work Entry' });
    await expect(editDialog).toBeVisible();
    const hoursInput = editDialog.getByLabel('Hours');
    await hoursInput.clear();
    await hoursInput.fill('10');

    // Update the description
    const descInput = editDialog.getByLabel('Description');
    await descInput.clear();
    await descInput.fill('Backend API development - extended session');

    // Submit the update
    await editDialog.getByRole('button', { name: 'Update' }).click();

    // Verify changes are reflected
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('10 hours')).toBeVisible();
    await expect(page.getByText('Backend API development - extended session')).toBeVisible();
  });

  // ---- Workflow 6: Delete the work entry ----
  test('6. Delete the work entry', async ({ page }) => {
    await login(page);

    // Navigate to Work Entries page via sidebar
    await navigateTo(page, 'Work Entries', '/work-entries');

    // Verify entry exists before deletion
    await expect(page.getByText('Acme Corporation')).toBeVisible();

    // Handle the confirm dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Click the delete button (second icon button in the row)
    const entryRow = page.getByRole('row').filter({ hasText: 'Acme Corporation' });
    const buttons = entryRow.getByRole('button');
    await buttons.nth(1).click();

    // Verify the entry was deleted - table should show empty state
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  // ---- Workflow 7: Check the reports page shows correct totals ----
  test('7. Check the reports page shows correct totals', async ({ page }) => {
    await login(page);

    // First, create two work entries for reports
    await navigateTo(page, 'Work Entries', '/work-entries');

    // Create first work entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    const dialog1 = page.getByRole('dialog', { name: 'Add New Work Entry' });
    await dialog1.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    await expect(page.locator('.MuiPopover-root')).toBeHidden();
    await dialog1.getByLabel('Hours').fill('5');
    await dialog1.getByLabel('Description').fill('Frontend work');
    await dialog1.getByRole('button', { name: 'Create' }).click();
    await expect(dialog1).toBeHidden();

    // Create second work entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    const dialog2 = page.getByRole('dialog', { name: 'Add New Work Entry' });
    await dialog2.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    await expect(page.locator('.MuiPopover-root')).toBeHidden();
    await dialog2.getByLabel('Hours').fill('3');
    await dialog2.getByLabel('Description').fill('Code review');
    await dialog2.getByRole('button', { name: 'Create' }).click();
    await expect(dialog2).toBeHidden();

    // Navigate to Reports page via sidebar
    await navigateTo(page, 'Reports', '/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();

    // Select the client (MUI Select without proper label association)
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();

    // Wait for report to load and verify totals
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText('8.00')).toBeVisible(); // 5 + 3 = 8 hours
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible(); // 2 entries

    // Verify the work entries table in the report
    await expect(page.getByText('Frontend work')).toBeVisible();
    await expect(page.getByText('Code review')).toBeVisible();
    await expect(page.getByText('5 hours')).toBeVisible();
    await expect(page.getByText('3 hours')).toBeVisible();
  });
});
