import { test, expect, type Page } from '@playwright/test';

const CLIENT_NAME = 'Acme Corp';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Work entries workflow', () => {
  let email: string;

  test.beforeEach(async ({ page, request }) => {
    email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

    const res = await request.post('/api/clients', {
      headers: { 'x-user-email': email },
      data: { name: CLIENT_NAME, description: 'Seeded by Playwright' },
    });
    // Backend rate-limits to 100 req / 15 min per IP; a 429 here means restart the backend.
    expect(res.status(), await res.text()).toBe(201);

    await login(page, email);
  });

  test('login, create, verify, edit and delete a work entry', async ({ page }) => {
    const description = `Initial work ${Date.now()}`;
    const updatedDescription = `${description} (updated)`;
    const today = new Date().toLocaleDateString('en-US', { timeZone: 'UTC' });

    await page.getByRole('button', { name: 'Work Entries' }).click();
    await expect(page).toHaveURL(/\/work-entries$/);
    await expect(page.getByRole('heading', { name: 'Work Entries', level: 4 })).toBeVisible();
    await expect(page.getByText('No work entries found')).toBeVisible();

    // Create
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    let dialog = page.getByRole('dialog', { name: 'Add New Work Entry' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
    await dialog.getByLabel('Hours').fill('3.5');
    await dialog.getByLabel('Description').fill(description);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();

    // Verify it appears in the list
    const row = page.getByRole('row').filter({ hasText: description });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CLIENT_NAME);
    await expect(row).toContainText('3.5 hours');
    await expect(row).toContainText(today);

    // Edit
    await row.getByTestId('EditIcon').click();
    dialog = page.getByRole('dialog', { name: 'Edit Work Entry' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Hours')).toHaveValue('3.5');
    await expect(dialog.getByLabel('Description')).toHaveValue(description);
    await dialog.getByLabel('Hours').fill('6');
    await dialog.getByLabel('Description').fill(updatedDescription);
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();

    const updatedRow = page.getByRole('row').filter({ hasText: updatedDescription });
    await expect(updatedRow).toHaveCount(1);
    await expect(updatedRow).toContainText('6 hours');
    await expect(updatedRow).not.toContainText('3.5 hours');

    // Delete
    page.once('dialog', async (confirm) => {
      expect(confirm.type()).toBe('confirm');
      expect(confirm.message()).toContain(`6 hour entry for ${CLIENT_NAME}`);
      await confirm.accept();
    });
    await updatedRow.getByTestId('DeleteIcon').click();
    await expect(updatedRow).toHaveCount(0);
    await expect(page.getByText('No work entries found')).toBeVisible();
  });
});
