import { test, expect, type Page } from '@playwright/test';

// Unique email per test run to avoid stale data from in-memory DB
const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-${RUN_ID}@example.com`;
const CLIENT_NAME = `TestClient-${RUN_ID}`;
const CLIENT_DEPT = 'Engineering';
const CLIENT_EMAIL = `client-${RUN_ID}@acme.com`;
const CLIENT_DESC = 'Primary consulting client';
const WORK_HOURS = '4';
const WORK_DESC = 'Frontend development work';
const EDITED_HOURS = '6';
const EDITED_DESC = 'Full-stack development work';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard');
}

async function selectClient(page: Page, clientName: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();
}

test.describe('Timesheet App E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('1 - Login flow', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();

    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
    await page.getByRole('button', { name: 'Log In' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('2 - Create a client', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await dialog.getByLabel('Client Name').fill(CLIENT_NAME);
    await dialog.getByLabel('Department').fill(CLIENT_DEPT);
    await dialog.getByLabel('Email').fill(CLIENT_EMAIL);
    await dialog.getByLabel('Description').fill(CLIENT_DESC);

    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible();

    // Verify client appears (use first() in case of multiple matches)
    await expect(page.getByRole('cell', { name: CLIENT_NAME }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: CLIENT_DEPT }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: CLIENT_EMAIL }).first()).toBeVisible();
  });

  test('3 - Create a work entry for that client', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    await selectClient(page, CLIENT_NAME);
    await dialog.getByLabel('Hours').fill(WORK_HOURS);
    await dialog.getByLabel('Description').fill(WORK_DESC);

    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByRole('cell', { name: CLIENT_NAME }).first()).toBeVisible();
    await expect(page.getByText(`${WORK_HOURS} hours`).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: WORK_DESC }).first()).toBeVisible();
  });

  test('4 - Verify the work entry appears in the list', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    await expect(page.getByRole('cell', { name: CLIENT_NAME }).first()).toBeVisible();
    await expect(page.getByText(`${WORK_HOURS} hours`).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: WORK_DESC }).first()).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hours' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('5 - Edit the work entry', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();

    await dialog.getByLabel('Hours').clear();
    await dialog.getByLabel('Hours').fill(EDITED_HOURS);
    await dialog.getByLabel('Description').clear();
    await dialog.getByLabel('Description').fill(EDITED_DESC);

    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByText(`${EDITED_HOURS} hours`).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: EDITED_DESC }).first()).toBeVisible();
  });

  test('6 - Delete the work entry', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    await expect(page.getByRole('cell', { name: CLIENT_NAME }).first()).toBeVisible();

    page.on('dialog', (d) => d.accept());

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).not.toBeVisible();
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  test('7 - Check the reports page shows correct totals', async ({ page }) => {
    await login(page);

    // Create two work entries for the report
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');

    // Entry 1: 3 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await selectClient(page, CLIENT_NAME);
    await dialog.getByLabel('Hours').fill('3');
    await dialog.getByLabel('Description').fill('Report test entry 1');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('3 hours').first()).toBeVisible();

    // Entry 2: 5 hours
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await selectClient(page, CLIENT_NAME);
    await dialog.getByLabel('Hours').fill('5');
    await dialog.getByLabel('Description').fill('Report test entry 2');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('5 hours').first()).toBeVisible();

    // Navigate to Reports
    await page.getByRole('button', { name: 'Reports' }).click();
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Select the client
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Wait for report data
    await expect(page.getByText('Total Hours')).toBeVisible();

    // Verify totals: 3 + 5 = 8 hours
    await expect(page.getByText('8.00').first()).toBeVisible();

    // Verify entry count and average
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();
    await expect(page.getByText('4.00').first()).toBeVisible();

    // Verify the work entries in the report table
    await expect(page.getByText('Report test entry 1')).toBeVisible();
    await expect(page.getByText('Report test entry 2')).toBeVisible();
  });
});
