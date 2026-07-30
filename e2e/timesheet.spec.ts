import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'playwright-e2e@test.com';
const CLIENT_NAME = 'Acme Corp';
const CLIENT_DEPT = 'Engineering';
const CLIENT_EMAIL = 'acme@example.com';
const CLIENT_DESC = 'E2E test client';
const WORK_HOURS = '4';
const WORK_DESC = 'Implemented feature X';
const UPDATED_HOURS = '6';
const UPDATED_DESC = 'Implemented feature X and Y';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

async function selectMuiDropdown(page: Page, labelText: string, optionName: string) {
  const formControl = page.locator('.MuiFormControl-root').filter({ hasText: labelText });
  await formControl.getByRole('combobox').click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Timesheet App E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('1 - Login flow', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    const emailInput = page.getByLabel('Email Address');
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('2 - Create a client', async ({ page }) => {
    await login(page);
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Add Client/i }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPT);
    await page.getByLabel('Email').fill(CLIENT_EMAIL);
    await page.getByLabel('Description').fill(CLIENT_DESC);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: CLIENT_DEPT })).toBeVisible();
  });

  test('3 - Create a work entry for that client', async ({ page }) => {
    await login(page);
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Add Work Entry/i }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    // Select client
    await selectMuiDropdown(page, 'Client', CLIENT_NAME);

    // Fill hours
    await page.getByLabel('Hours').fill(WORK_HOURS);

    // Date defaults to today - leave as is

    // Fill description
    await page.getByLabel('Description').fill(WORK_DESC);

    // Submit and wait for API response
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/work-entries') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Dialog should close and entry should appear
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByText(WORK_DESC)).toBeVisible();
  });

  test('4 - Verify the work entry appears in the list', async ({ page }) => {
    await login(page);
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 5000 });

    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByText(WORK_DESC)).toBeVisible();
  });

  test('5 - Edit the work entry', async ({ page }) => {
    await login(page);
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 5000 });

    // Click edit button (first button in the row)
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();

    // Update hours
    const hoursField = page.getByLabel('Hours');
    await hoursField.clear();
    await hoursField.fill(UPDATED_HOURS);

    // Update description
    const descField = page.getByLabel('Description');
    await descField.clear();
    await descField.fill(UPDATED_DESC);

    // Submit and wait for API response
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/work-entries') && resp.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Update' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify updated values
    await expect(page.getByText(`${UPDATED_HOURS} hours`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UPDATED_DESC)).toBeVisible();
  });

  test('6 - Delete the work entry', async ({ page }) => {
    await login(page);
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 5000 });

    // Accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button (second button in the row)
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').nth(1).click();

    // Verify entry is gone
    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });

  test('7 - Check the reports page shows correct totals', async ({ page }) => {
    await login(page);

    // Create work entries for the report
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 5000 });

    // Create first entry (3 hours)
    await page.getByRole('button', { name: /Add Work Entry/i }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiDropdown(page, 'Client', CLIENT_NAME);
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Report test entry 1');
    const resp1 = page.waitForResponse(r => r.url().includes('/api/work-entries') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create' }).click();
    await resp1;
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 5000 });

    // Create second entry (5 hours)
    await page.getByRole('button', { name: /Add Work Entry/i }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiDropdown(page, 'Client', CLIENT_NAME);
    await page.getByLabel('Hours').fill('5');
    await page.getByLabel('Description').fill('Report test entry 2');
    const resp2 = page.waitForResponse(r => r.url().includes('/api/work-entries') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create' }).click();
    await resp2;
    await expect(page.getByText('5 hours')).toBeVisible({ timeout: 5000 });

    // Navigate to Reports
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 5000 });

    // Select client in the report dropdown
    await selectMuiDropdown(page, 'Select Client', CLIENT_NAME);

    // Verify totals: 3 + 5 = 8 hours, 2 entries
    await expect(page.getByText('8.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2').first()).toBeVisible();

    // Verify entries are listed in the report table
    await expect(page.getByText('Report test entry 1')).toBeVisible();
    await expect(page.getByText('Report test entry 2')).toBeVisible();
  });
});
