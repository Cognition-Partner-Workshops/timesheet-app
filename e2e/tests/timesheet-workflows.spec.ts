import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'E2E Test Client';
const CLIENT_DESCRIPTION = 'Created by Playwright E2E tests';
const CLIENT_DEPARTMENT = 'Engineering';
const WORK_ENTRY_HOURS = '4';
const WORK_ENTRY_DESCRIPTION = 'E2E test work entry';
const UPDATED_WORK_ENTRY_HOURS = '6';
const UPDATED_WORK_ENTRY_DESCRIPTION = 'Updated E2E test work entry';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

test.describe('Timesheet App E2E Workflows', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. Login flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Time Tracker' })).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test('2. Create a client', async ({ page }) => {
    await login(page);

    await page.goto('/clients');
    await expect(page.locator('h4', { hasText: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();

    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPARTMENT);
    await page.getByLabel('Description').fill(CLIENT_DESCRIPTION);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: CLIENT_DEPARTMENT })).toBeVisible();
  });

  test('3. Create a work entry for that client', async ({ page }) => {
    await login(page);

    await page.goto('/work-entries');
    await expect(page.locator('h4', { hasText: 'Work Entries' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    // Select client from dropdown - MUI Select uses a div with role=combobox
    await page.locator('.MuiDialog-root .MuiSelect-select').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    await page.getByLabel('Hours *').fill(WORK_ENTRY_HOURS);
    await page.locator('.MuiDialog-root textarea[rows]').fill(WORK_ENTRY_DESCRIPTION);

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`${WORK_ENTRY_HOURS} hours`)).toBeVisible();
  });

  test('4. Verify the work entry appears in the list', async ({ page }) => {
    await login(page);

    await page.goto('/work-entries');
    await expect(page.locator('h4', { hasText: 'Work Entries' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText(`${WORK_ENTRY_HOURS} hours`)).toBeVisible();
    await expect(row.getByText(WORK_ENTRY_DESCRIPTION)).toBeVisible();
  });

  test('5. Edit the work entry', async ({ page }) => {
    await login(page);

    await page.goto('/work-entries');
    await expect(page.locator('h4', { hasText: 'Work Entries' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await expect(row).toBeVisible();
    // Edit button is the first icon button in the row
    await row.getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();

    const hoursField = page.getByLabel('Hours *');
    await hoursField.clear();
    await hoursField.fill(UPDATED_WORK_ENTRY_HOURS);

    const descField = page.locator('.MuiDialog-root textarea[rows]');
    await descField.clear();
    await descField.fill(UPDATED_WORK_ENTRY_DESCRIPTION);

    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText(`${UPDATED_WORK_ENTRY_HOURS} hours`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(UPDATED_WORK_ENTRY_DESCRIPTION)).toBeVisible();
  });

  test('6. Delete the work entry', async ({ page }) => {
    await login(page);

    await page.goto('/work-entries');
    await expect(page.locator('h4', { hasText: 'Work Entries' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME });
    await expect(row).toBeVisible();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Delete button is the second icon button
    await row.getByRole('button').nth(1).click();

    await expect(page.getByText('No work entries found')).toBeVisible({ timeout: 10000 });
  });

  test('7. Check the reports page shows correct totals', async ({ page }) => {
    await login(page);

    // Create a fresh work entry for the report
    await page.goto('/work-entries');
    await expect(page.locator('h4', { hasText: 'Work Entries' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    await page.locator('.MuiDialog-root .MuiSelect-select').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await page.getByLabel('Hours *').fill('3');
    await page.locator('.MuiDialog-root textarea[rows]').fill('Report test entry');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('3 hours')).toBeVisible({ timeout: 10000 });

    // Navigate to Reports page
    await page.goto('/reports');
    await expect(page.locator('h4', { hasText: 'Reports' })).toBeVisible();

    // Select the client from MUI Select dropdown
    await page.locator('.MuiSelect-select').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // Verify report totals
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 10000 });
    // Total Hours card should show 3.00
    const totalHoursCard = page.locator('.MuiCard-root').filter({ hasText: 'Total Hours' });
    await expect(totalHoursCard.locator('.MuiTypography-h4')).toHaveText('3.00');
    // Total Entries card should show 1
    const totalEntriesCard = page.locator('.MuiCard-root').filter({ hasText: 'Total Entries' });
    await expect(totalEntriesCard.locator('.MuiTypography-h4')).toHaveText('1');

    // Verify work entry details in the report table
    await expect(page.getByText('Report test entry')).toBeVisible();
  });
});
