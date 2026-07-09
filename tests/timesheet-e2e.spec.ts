import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';

async function navigateTo(page: Page, name: string) {
  const nav = page.locator('nav');
  await nav.getByText(name, { exact: true }).first().click();
}

async function selectMuiOption(page: Page, labelText: string, optionText: string) {
  // MUI Select: click the label/trigger area, then pick the option from the dropdown
  const formControl = page.locator('.MuiFormControl-root').filter({ hasText: labelText });
  await formControl.locator('.MuiSelect-select').click();
  await page.getByRole('option', { name: optionText }).click();
}

test.describe('Timesheet App E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ---------- 1. Login Flow ----------
  test('1 - Login flow', async () => {
    await page.goto('/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();

    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();

    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  // ---------- 2. Create a Client ----------
  test('2 - Create a client', async () => {
    await navigateTo(page, 'Clients');
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: /add client/i }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@example.com');
    await page.getByLabel('Description').fill('Test client for E2E');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'acme@example.com' })).toBeVisible();
  });

  // ---------- 3. Create a Work Entry ----------
  test('3 - Create a work entry for that client', async () => {
    await navigateTo(page, 'Work Entries');
    await expect(page).toHaveURL(/\/work-entries/);
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible();

    await page.getByRole('button', { name: /add work entry/i }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // Select client via MUI Select
    await selectMuiOption(page, 'Client', 'Acme Corp');

    await page.getByLabel('Hours').fill('4.5');
    await page.getByLabel('Description').fill('Frontend development work');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('4.5 hours')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Frontend development work' })).toBeVisible();
  });

  // ---------- 4. Verify Work Entry Appears in List ----------
  test('4 - Verify the work entry appears in the list', async () => {
    await expect(page).toHaveURL(/\/work-entries/);

    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table.getByText('Acme Corp')).toBeVisible();
    await expect(table.getByText('4.5 hours')).toBeVisible();
    await expect(table.getByText('Frontend development work')).toBeVisible();

    const row = table.locator('tr').filter({ hasText: 'Acme Corp' });
    await expect(row.locator('button')).toHaveCount(2);
  });

  // ---------- 5. Edit the Work Entry ----------
  test('5 - Edit the work entry', async () => {
    await expect(page).toHaveURL(/\/work-entries/);

    const table = page.locator('table');
    const row = table.locator('tr').filter({ hasText: 'Acme Corp' });
    await row.locator('button').first().click();

    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    const hoursInput = page.getByLabel('Hours');
    await hoursInput.clear();
    await hoursInput.fill('6');

    const descInput = page.getByLabel('Description');
    await descInput.clear();
    await descInput.fill('Updated frontend development work');

    await page.getByRole('button', { name: /update/i }).click();

    await expect(page.getByText('6 hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Updated frontend development work')).toBeVisible();
    await expect(page.getByText('4.5 hours')).not.toBeVisible();
  });

  // ---------- 6. Delete the Work Entry ----------
  test('6 - Delete the work entry', async () => {
    await expect(page).toHaveURL(/\/work-entries/);

    const table = page.locator('table');
    const row = table.locator('tr').filter({ hasText: 'Acme Corp' });

    page.on('dialog', (dialog) => dialog.accept());
    await row.locator('button').nth(1).click();

    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 5000 });
  });

  // ---------- 7. Reports Page Shows Correct Totals ----------
  test('7 - Reports page shows correct totals', async () => {
    // Create two work entries for reporting
    await navigateTo(page, 'Work Entries');
    await expect(page).toHaveURL(/\/work-entries/);

    // Create first entry: 3 hours
    await page.getByRole('button', { name: /add work entry/i }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await selectMuiOption(page, 'Client', 'Acme Corp');
    await page.getByLabel('Hours').fill('3');
    await page.getByLabel('Description').fill('Report test entry 1');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 5000 });

    // Create second entry: 5 hours
    await page.getByRole('button', { name: /add work entry/i }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await selectMuiOption(page, 'Client', 'Acme Corp');
    await page.getByLabel('Hours').fill('5');
    await page.getByLabel('Description').fill('Report test entry 2');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText('5 hours')).toBeVisible({ timeout: 5000 });

    // Navigate to reports
    await navigateTo(page, 'Reports');
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Select the client
    await selectMuiOption(page, 'Select Client', 'Acme Corp');

    // Verify totals: 3 + 5 = 8 hours, 2 entries, avg = 4.00
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('8.00')).toBeVisible();
    await expect(page.getByText('4.00')).toBeVisible();

    // Verify Total Entries shows 2
    const entriesCard = page.locator('.MuiCard-root').filter({ hasText: 'Total Entries' });
    await expect(entriesCard.locator('.MuiTypography-h4')).toHaveText('2');

    // Verify the individual entries are listed
    await expect(page.getByText('Report test entry 1')).toBeVisible();
    await expect(page.getByText('Report test entry 2')).toBeVisible();
  });
});
