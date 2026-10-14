import { test, expect, type Page } from '@playwright/test';

const ENTRY_HOURS = '4.5';
const ENTRY_DESCRIPTION = 'Frontend development work';

/** Click a MUI Select by its label text and pick an option */
async function selectMuiOption(page: Page, labelText: string, optionName: string) {
  const formControl = page.locator('.MuiFormControl-root', {
    has: page.locator(`label:has-text("${labelText}")`),
  });
  await formControl.locator('[role="combobox"]').click();
  await page.getByRole('option', { name: optionName }).click();
}

/** Log in with a given email */
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

/** Create a client and return its name */
async function createClient(page: Page, clientName: string) {
  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
  await page.getByLabel('Client Name').fill(clientName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(clientName)).toBeVisible({ timeout: 15000 });
}

test.describe('Time Entry Workflow', () => {
  test('should create a work entry and verify it in the list', async ({ page }) => {
    const email = `e2e-entry1-${Date.now()}@example.com`;
    const clientName = `Entry Client ${Date.now()}`;
    await login(page, email);
    await createClient(page, clientName);

    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/entries-01-empty-list.png' });

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();

    await selectMuiOption(page, 'Client', clientName);
    await page.getByLabel('Hours').fill(ENTRY_HOURS);
    await page.getByLabel('Description').fill(ENTRY_DESCRIPTION);
    await page.screenshot({ path: 'e2e/screenshots/entries-02-create-form.png' });

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(clientName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`${ENTRY_HOURS} hours`)).toBeVisible();
    await expect(page.getByText(ENTRY_DESCRIPTION)).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/entries-03-entry-created.png' });
  });

  test('should verify hours total on dashboard after creating entries', async ({ page }) => {
    const email = `e2e-entry2-${Date.now()}@example.com`;
    const clientName = `Hours Client ${Date.now()}`;
    await login(page, email);
    await createClient(page, clientName);

    await page.goto('/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible({ timeout: 15000 });

    // Create first entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiOption(page, 'Client', clientName);
    await page.getByLabel('Hours').fill(ENTRY_HOURS);
    await page.getByLabel('Description').fill(ENTRY_DESCRIPTION);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(`${ENTRY_HOURS} hours`)).toBeVisible({ timeout: 15000 });

    // Create second entry
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    await selectMuiOption(page, 'Client', clientName);
    await page.getByLabel('Hours').fill('3.5');
    await page.getByLabel('Description').fill('Backend API development');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('3.5 hours')).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/entries-04-multiple-entries.png' });

    // Navigate to dashboard and verify total hours
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    const totalHoursExpected = (parseFloat(ENTRY_HOURS) + 3.5).toFixed(2);
    await expect(page.getByText(totalHoursExpected)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/entries-05-dashboard-total-hours.png' });
  });
});
