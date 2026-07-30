import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'Acme Corp';
const CLIENT_DEPT = 'Engineering';
const CLIENT_DESC = 'Test client for E2E';
const WORK_HOURS = '4';
const WORK_DESC = 'Backend development work';

const UPDATED_HOURS = '6';
const UPDATED_DESC = 'Updated: full-stack development';

const API_BASE = 'http://localhost:3001';

async function cleanupTestData(request: APIRequestContext) {
  const headers = { 'x-user-email': TEST_EMAIL };

  // Login first to ensure user exists
  await request.post(`${API_BASE}/api/auth/login`, {
    data: { email: TEST_EMAIL },
  });

  // Delete all clients (cascades to work entries)
  await request.delete(`${API_BASE}/api/clients`, { headers });
}

test.describe('Time Tracker E2E Workflows', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser, playwright }) => {
    const request = await playwright.request.newContext();
    await cleanupTestData(request);
    await request.dispose();
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1 - Login flow', async () => {
    await page.goto('/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('2 - Create a client', async () => {
    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPT);
    await page.getByLabel('Description').fill(CLIENT_DESC);

    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for dialog to close and verify client appears in table
    await expect(page.getByRole('heading', { name: 'Add New Client' })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: CLIENT_NAME, exact: true })).toBeVisible();
    await expect(page.getByText(CLIENT_DEPT)).toBeVisible();
  });

  test('3 - Create a work entry for that client', async () => {
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    // Select the client from dropdown
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Fill hours
    await dialog.getByRole('spinbutton', { name: 'Hours' }).fill(WORK_HOURS);

    // Fill description
    await dialog.getByRole('textbox', { name: 'Description' }).fill(WORK_DESC);

    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for dialog to close
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).not.toBeVisible();

    // Verify entry appears
    await expect(page.getByRole('cell', { name: CLIENT_NAME, exact: true })).toBeVisible();
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByRole('cell', { name: WORK_DESC })).toBeVisible();
  });

  test('4 - Verify work entry appears in the list', async () => {
    // Reload the page to ensure persistence
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible();

    // Verify the entry is still visible after reload
    await expect(page.getByRole('cell', { name: CLIENT_NAME, exact: true })).toBeVisible();
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByRole('cell', { name: WORK_DESC })).toBeVisible();

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hours' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('5 - Edit the work entry', async () => {
    // Find the row with our work entry and click the edit button
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').first().click(); // Edit is first icon button

    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();

    // Update hours
    const editDialog = page.getByRole('dialog');
    const hoursField = editDialog.getByRole('spinbutton', { name: 'Hours' });
    await hoursField.clear();
    await hoursField.fill(UPDATED_HOURS);

    // Update description
    const descField = editDialog.getByRole('textbox', { name: 'Description' });
    await descField.clear();
    await descField.fill(UPDATED_DESC);

    await page.getByRole('button', { name: 'Update' }).click();

    // Wait for dialog to close
    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).not.toBeVisible();

    // Verify updated values
    await expect(page.getByText(`${UPDATED_HOURS} hours`)).toBeVisible();
    await expect(page.getByRole('cell', { name: UPDATED_DESC })).toBeVisible();
  });

  test('6 - Delete the work entry', async () => {
    // Set up dialog handler before clicking delete
    page.once('dialog', (dialog) => dialog.accept());

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').nth(1).click(); // Delete is second icon button

    // Verify the entry is removed - table should show empty state
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  test('7 - Reports page shows correct totals', async () => {
    // First, create a new work entry so we have data for the report
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const reportDialog1 = page.getByRole('dialog');
    await reportDialog1.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await reportDialog1.getByRole('spinbutton', { name: 'Hours' }).fill('3');
    await reportDialog1.getByRole('textbox', { name: 'Description' }).fill('Report test entry 1');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).not.toBeVisible();

    // Create a second entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const reportDialog2 = page.getByRole('dialog');
    await reportDialog2.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await reportDialog2.getByRole('spinbutton', { name: 'Hours' }).fill('5');
    await reportDialog2.getByRole('textbox', { name: 'Description' }).fill('Report test entry 2');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).not.toBeVisible();

    // Navigate to reports
    await page.getByRole('button', { name: 'Reports' }).click();
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Select the client from the MUI Select dropdown
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Verify report summary cards
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText('8.00')).toBeVisible(); // 3 + 5 = 8
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();
    await expect(page.getByText('4.00')).toBeVisible(); // 8 / 2 = 4

    // Verify individual entries in the report table
    await expect(page.getByRole('cell', { name: 'Report test entry 1' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Report test entry 2' })).toBeVisible();
  });
});
