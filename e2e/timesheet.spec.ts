import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'Acme Corp';
const CLIENT_DEPT = 'Engineering';
const CLIENT_EMAIL = 'contact@acme.com';
const CLIENT_DESC = 'E2E test client';
const WORK_HOURS = '4';
const WORK_DESC = 'Implemented feature X';
const EDITED_HOURS = '6';
const EDITED_DESC = 'Implemented feature X and Y';

async function selectMuiOption(page: Page, label: string, optionName: string) {
  // MUI Select: click the combobox to open the dropdown, then pick the option
  await page.locator(`label:has-text("${label}")`).locator('..').locator('[role="combobox"]').click();
  await page.getByRole('option', { name: optionName }).click();
}

async function fillDatePicker(page: Page, label: string, month: string, day: string, year: string) {
  const group = page.getByRole('group', { name: label });
  const monthSpin = group.getByRole('spinbutton', { name: 'Month' });
  const daySpin = group.getByRole('spinbutton', { name: 'Day' });
  const yearSpin = group.getByRole('spinbutton', { name: 'Year' });

  await monthSpin.click();
  await monthSpin.fill(month);
  await daySpin.click();
  await daySpin.fill(day);
  await yearSpin.click();
  await yearSpin.fill(year);
}

test.describe('Time Tracker E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. Login flow', async () => {
    await page.goto('/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    // Button should be disabled with empty email
    const loginButton = page.getByRole('button', { name: 'Log In' });
    await expect(loginButton).toBeDisabled();

    // Fill email and log in
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await expect(loginButton).toBeEnabled();
    await loginButton.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('2. Create a client', async () => {
    await page.getByRole('button', { name: 'Clients' }).click();
    await expect(page).toHaveURL(/\/clients/);

    await expect(page.getByText('No clients found')).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPT);
    await page.getByLabel('Email').fill(CLIENT_EMAIL);
    await page.getByLabel('Description').fill(CLIENT_DESC);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLIENT_DEPT)).toBeVisible();
    await expect(page.getByText(CLIENT_EMAIL)).toBeVisible();
  });

  test('3. Create a work entry for that client', async () => {
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await expect(page).toHaveURL(/\/work-entries/);

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // Select client from MUI Select dropdown
    await selectMuiOption(page, 'Client', CLIENT_NAME);

    // Fill hours
    await page.getByRole('spinbutton', { name: 'Hours' }).fill(WORK_HOURS);

    // Fill date using the DatePicker spinbuttons
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = String(today.getFullYear());
    await fillDatePicker(page, 'Date', month, day, year);

    // Fill description
    await page.getByRole('textbox', { name: 'Description' }).fill(WORK_DESC);

    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the entry appears
    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
  });

  test('4. Verify work entry appears in the list', async () => {
    await expect(page).toHaveURL(/\/work-entries/);

    const row = page.locator('tr', { has: page.getByText(CLIENT_NAME) });
    await expect(row.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(row.getByText(WORK_DESC)).toBeVisible();
  });

  test('5. Edit the work entry', async () => {
    // Click the edit (first) icon button on the work entry row
    const row = page.locator('tr', { has: page.getByText(CLIENT_NAME) });
    await row.getByRole('button').first().click();

    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    // Update hours
    const hoursInput = page.getByRole('spinbutton', { name: 'Hours' });
    await hoursInput.clear();
    await hoursInput.fill(EDITED_HOURS);

    // Update description
    const descInput = page.getByRole('textbox', { name: 'Description' });
    await descInput.clear();
    await descInput.fill(EDITED_DESC);

    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText(`${EDITED_HOURS} hours`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(EDITED_DESC)).toBeVisible();
  });

  test('6. Delete the work entry', async () => {
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete (second) icon button on the row
    const row = page.locator('tr', { has: page.getByText(CLIENT_NAME) });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });

  test('7. Reports page shows correct totals', async () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = String(today.getFullYear());

    // Create first work entry (3 hours)
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await selectMuiOption(page, 'Client', CLIENT_NAME);
    await page.getByRole('spinbutton', { name: 'Hours' }).fill('3');
    await fillDatePicker(page, 'Date', month, day, year);
    await page.getByRole('textbox', { name: 'Description' }).fill('Report test entry');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 5000 });

    // Create second work entry (5 hours)
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await selectMuiOption(page, 'Client', CLIENT_NAME);
    await page.getByRole('spinbutton', { name: 'Hours' }).fill('5');
    await fillDatePicker(page, 'Date', month, day, year);
    await page.getByRole('textbox', { name: 'Description' }).fill('Second report entry');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('5 hours')).toBeVisible({ timeout: 5000 });

    // Navigate to reports
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports/);

    // Select the client
    await selectMuiOption(page, 'Select Client', CLIENT_NAME);

    // Wait for report to load and verify totals: 3 + 5 = 8 hours, 2 entries, avg 4.00
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('8.00')).toBeVisible();
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();
    await expect(page.getByText('4.00')).toBeVisible();

    // Verify entries appear in the report table
    await expect(page.getByText('Report test entry')).toBeVisible();
    await expect(page.getByText('Second report entry')).toBeVisible();
  });
});
