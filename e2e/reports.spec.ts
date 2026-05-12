import { test, expect } from '@playwright/test';

const uniqueEmail = () => `reports-${Date.now()}@example.com`;

async function loginCreateClientAndEntries(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Create a client
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill('Report Client');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Create work entries with known hours
  await page.goto('/work-entries');

  // Entry 1: 3 hours
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.getByRole('combobox', { name: 'Client' }).click();
  await page.getByRole('option', { name: 'Report Client' }).click();
  await page.getByLabel('Hours').fill('3');
  await page.getByLabel('Description').fill('Report entry 1');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Entry 2: 5.5 hours
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.getByRole('combobox', { name: 'Client' }).click();
  await page.getByRole('option', { name: 'Report Client' }).click();
  await page.getByLabel('Hours').fill('5.5');
  await page.getByLabel('Description').fill('Report entry 2');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

test.describe('Reporting', () => {
  test('should show correct totals for a client report', async ({ page }) => {
    const email = uniqueEmail();
    await loginCreateClientAndEntries(page, email);

    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Select the client
    await page.getByRole('combobox', { name: 'Select Client' }).click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Verify total hours = 3 + 5.5 = 8.5
    await expect(page.getByText('8.50')).toBeVisible();

    // Verify entry count = 2
    await expect(page.getByText('2').first()).toBeVisible();

    // Verify average = 8.5 / 2 = 4.25
    await expect(page.getByText('4.25')).toBeVisible();
  });

  test('should display individual entries in report table', async ({ page }) => {
    const email = uniqueEmail();
    await loginCreateClientAndEntries(page, email);

    await page.goto('/reports');

    await page.getByRole('combobox', { name: 'Select Client' }).click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    // Verify individual entries are listed
    await expect(page.getByText('Report entry 1')).toBeVisible();
    await expect(page.getByText('Report entry 2')).toBeVisible();
    await expect(page.getByText('3 hours')).toBeVisible();
    await expect(page.getByText('5.5 hours')).toBeVisible();
  });

  test('should show prompt when no clients exist', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(email);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/reports');
    await expect(page.getByText(/create at least one client/i)).toBeVisible();
  });
});
