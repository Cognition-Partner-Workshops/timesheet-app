import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'Acme Corp';
const CLIENT_DEPT = 'Engineering';
const CLIENT_EMAIL = 'acme@example.com';
const CLIENT_DESC = 'Test client for E2E';
const WORK_HOURS = '4';
const WORK_DESC = 'Implemented feature X';
const UPDATED_HOURS = '6';
const UPDATED_DESC = 'Implemented feature X and Y';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

async function navigateTo(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByRole('navigation').getByRole('button', { name }).click();
  await page.waitForLoadState('networkidle');
}

async function openWorkEntryDialog(page: import('@playwright/test').Page) {
  const addButton = page.getByRole('main').getByRole('button', { name: /add work entry/i });
  await addButton.waitFor({ state: 'visible' });
  // Small delay to ensure React has finished re-rendering after data load
  await page.waitForTimeout(300);
  await addButton.click();
  await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible({ timeout: 10000 });
}

test.describe('Timesheet App E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('1 - Login flow', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('This app intentionally does not have a password field.')).toBeVisible();

    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('2 - Create a client', async ({ page }) => {
    await login(page);
    await navigateTo(page, /clients/i);

    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: /add client/i }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPT);
    await page.getByLabel('Email', { exact: true }).fill(CLIENT_EMAIL);
    await page.getByLabel('Description').fill(CLIENT_DESC);

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: CLIENT_DEPT })).toBeVisible();
    await expect(page.getByRole('cell', { name: CLIENT_EMAIL })).toBeVisible();
  });

  test('3 - Create a work entry for that client', async ({ page }) => {
    await login(page);
    await navigateTo(page, /work entries/i);
    await openWorkEntryDialog(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    await dialog.getByRole('spinbutton', { name: 'Hours' }).fill(WORK_HOURS);
    await dialog.getByRole('textbox', { name: 'Description' }).fill(WORK_DESC);

    await dialog.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
  });

  test('4 - Verify work entry appears in the list', async ({ page }) => {
    await login(page);
    await navigateTo(page, /work entries/i);

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByRole('cell', { name: WORK_DESC })).toBeVisible();
  });

  test('5 - Edit the work entry', async ({ page }) => {
    await login(page);
    await navigateTo(page, /work entries/i);

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 10000 });

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible({ timeout: 10000 });

    const dialog = page.getByRole('dialog');

    const hoursInput = dialog.getByRole('spinbutton', { name: 'Hours' });
    await hoursInput.clear();
    await hoursInput.fill(UPDATED_HOURS);

    const descInput = dialog.getByRole('textbox', { name: 'Description' });
    await descInput.clear();
    await descInput.fill(UPDATED_DESC);

    await dialog.getByRole('button', { name: /update/i }).click();

    await expect(page.getByText(`${UPDATED_HOURS} hours`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: UPDATED_DESC })).toBeVisible();
  });

  test('6 - Delete the work entry', async ({ page }) => {
    await login(page);
    await navigateTo(page, /work entries/i);

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 10000 });

    page.on('dialog', dialog => dialog.accept());

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await row.getByRole('button').nth(1).click();

    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 10000 });
  });

  test('7 - Reports page shows correct totals', async ({ page }) => {
    await login(page);

    // Re-create a work entry so reports have data
    await navigateTo(page, /work entries/i);
    await openWorkEntryDialog(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await dialog.getByRole('spinbutton', { name: 'Hours' }).fill('8');
    await dialog.getByRole('textbox', { name: 'Description' }).fill('Report test entry');
    await dialog.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('8 hours')).toBeVisible({ timeout: 10000 });

    // Navigate to reports page
    await navigateTo(page, /reports/i);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Select the client
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Wait for report data to load
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 10000 });

    // Verify report summary
    await expect(page.getByText('8.00').first()).toBeVisible();
    await expect(page.getByText('Total Entries')).toBeVisible();
    const mainContent = page.getByRole('main');
    await expect(mainContent).toContainText('Total Hours');
    await expect(mainContent).toContainText('Total Entries');
    await expect(mainContent).toContainText('8.00');
    // Verify the report table shows the entry
    await expect(page.getByRole('cell', { name: 'Report test entry' })).toBeVisible();
  });
});
