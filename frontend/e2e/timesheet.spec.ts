import { test, expect, Locator } from '@playwright/test';
import { login, selectMuiOption } from './helpers';

/**
 * End-to-end coverage of the core Time Tracking workflows:
 *  1. Login
 *  2. Create a client
 *  3. Create a work entry for that client
 *  4. Verify the work entry appears in the list
 *  5. Edit the work entry
 *  6. Delete the work entry
 *  7. Reports page shows correct totals
 *
 * The suite runs serially against a shared in-memory backend, so a unique
 * user/client per run keeps it isolated from any leftover data.
 */
const RUN = Date.now();
const EMAIL = `e2e-${RUN}@example.com`;
const CLIENT_NAME = `Acme Corp ${RUN}`;
const ENTRY_DESC = 'Initial development work';

test.describe.configure({ mode: 'serial' });

// Auto-accept native confirm() dialogs used for deletions.
test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

/** Find the work-entries table row that contains the given text. */
function workEntryRow(page: import('@playwright/test').Page, text: string): Locator {
  return page.getByRole('row').filter({ hasText: text });
}

test('1. login flow authenticates the user', async ({ page }) => {
  await login(page, EMAIL);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // The logged-in email is shown in the top bar.
  await expect(page.getByText(EMAIL)).toBeVisible();
});

test('2. create a client', async ({ page }) => {
  await login(page, EMAIL);
  await page.goto('/clients');

  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(CLIENT_NAME);
  await page.getByLabel('Department').fill('Engineering');
  await page.getByRole('button', { name: 'Create' }).click();

  // The new client shows up in the table.
  await expect(page.getByRole('cell', { name: CLIENT_NAME })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();
});

test('3. create a work entry for the client', async ({ page }) => {
  await login(page, EMAIL);
  await page.goto('/work-entries');

  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await selectMuiOption(page, CLIENT_NAME);
  await page.getByLabel('Hours').fill('5');
  await page.getByLabel('Description').fill(ENTRY_DESC);
  await page.getByRole('button', { name: 'Create' }).click();

  // Dialog closes on success.
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('4. work entry appears in the list', async ({ page }) => {
  await login(page, EMAIL);
  await page.goto('/work-entries');

  const row = workEntryRow(page, ENTRY_DESC);
  await expect(row).toBeVisible();
  await expect(row.getByText(CLIENT_NAME)).toBeVisible();
  await expect(row.getByText('5 hours')).toBeVisible();
});

test('5. edit the work entry', async ({ page }) => {
  await login(page, EMAIL);
  await page.goto('/work-entries');

  const row = workEntryRow(page, ENTRY_DESC);
  await row.getByTestId('EditIcon').click();

  const hours = page.getByLabel('Hours');
  await expect(hours).toHaveValue('5');
  await hours.fill('8');
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  const updated = workEntryRow(page, ENTRY_DESC);
  await expect(updated.getByText('8 hours')).toBeVisible();
  await expect(updated.getByText('5 hours')).toBeHidden();
});

test('6. delete the work entry', async ({ page }) => {
  await login(page, EMAIL);
  await page.goto('/work-entries');

  await workEntryRow(page, ENTRY_DESC).getByTestId('DeleteIcon').click();

  await expect(workEntryRow(page, ENTRY_DESC)).toHaveCount(0);
  await expect(
    page.getByText('No work entries found. Add your first work entry to get started.')
  ).toBeVisible();
});

test('7. reports page shows correct totals', async ({ page }) => {
  await login(page, EMAIL);

  // Seed two entries with known hours so the totals are deterministic.
  const entries = [
    { hours: '3', desc: `Report entry A ${RUN}` },
    { hours: '4.5', desc: `Report entry B ${RUN}` },
  ];
  for (const e of entries) {
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectMuiOption(page, CLIENT_NAME);
    await page.getByLabel('Hours').fill(e.hours);
    await page.getByLabel('Description').fill(e.desc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }

  await page.goto('/reports');
  await selectMuiOption(page, CLIENT_NAME);

  const card = (title: string) =>
    page.locator('.MuiCard-root').filter({ hasText: title });

  // Total Hours = 3 + 4.5 = 7.50, 2 entries, average 3.75.
  await expect(card('Total Hours').getByText('7.50')).toBeVisible();
  await expect(card('Total Entries').getByText('2', { exact: true })).toBeVisible();
  await expect(card('Average Hours per Entry').getByText('3.75')).toBeVisible();
});
