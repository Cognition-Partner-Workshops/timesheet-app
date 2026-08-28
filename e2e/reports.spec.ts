import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = `e2e-reports-${Date.now()}@example.com`;
const CLIENT_NAME = 'Global Analytics';
const ENTRY_HOURS_1 = '5';
const ENTRY_HOURS_2 = '3';
const ENTRY_DESC_1 = 'Data pipeline implementation';
const ENTRY_DESC_2 = 'Dashboard design';

/** Click a MUI Select by its label text and pick an option */
async function selectMuiOption(page: Page, labelText: string, optionName: string) {
  const formControl = page.locator('.MuiFormControl-root', {
    has: page.locator(`label:has-text("${labelText}")`),
  });
  await formControl.locator('[role="combobox"]').click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Report Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Create a client
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(CLIENT_NAME)).toBeVisible({ timeout: 15000 });

    // Create first work entry
    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiOption(page, 'Client', CLIENT_NAME);
    await page.getByLabel('Hours').fill(ENTRY_HOURS_1);
    await page.getByLabel('Description').fill(ENTRY_DESC_1);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(`${ENTRY_HOURS_1} hours`)).toBeVisible({ timeout: 15000 });

    // Create second work entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiOption(page, 'Client', CLIENT_NAME);
    await page.getByLabel('Hours').fill(ENTRY_HOURS_2);
    await page.getByLabel('Description').fill(ENTRY_DESC_2);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(`${ENTRY_HOURS_2} hours`)).toBeVisible({ timeout: 15000 });
  });

  test('should display report data matching created entries', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/reports-01-reports-page.png' });

    // Select the client from the dropdown
    await selectMuiOption(page, 'Select Client', CLIENT_NAME);

    // Wait for report data to load
    const totalHours = (parseFloat(ENTRY_HOURS_1) + parseFloat(ENTRY_HOURS_2)).toFixed(2);
    await expect(page.getByText(totalHours)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/reports-02-report-summary.png' });

    // Verify summary cards
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText(totalHours)).toBeVisible();

    await expect(page.getByText('Total Entries')).toBeVisible();

    await expect(page.getByText('Average Hours per Entry')).toBeVisible();
    const avgHours = ((parseFloat(ENTRY_HOURS_1) + parseFloat(ENTRY_HOURS_2)) / 2).toFixed(2);
    await expect(page.getByText(avgHours)).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/reports-03-report-cards.png' });

    // Verify work entries in the report table
    await expect(page.getByText(`${ENTRY_HOURS_1} hours`)).toBeVisible();
    await expect(page.getByText(`${ENTRY_HOURS_2} hours`)).toBeVisible();
    await expect(page.getByText(ENTRY_DESC_1)).toBeVisible();
    await expect(page.getByText(ENTRY_DESC_2)).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/reports-04-report-table.png' });
  });
});
