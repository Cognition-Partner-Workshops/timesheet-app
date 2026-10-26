import { test, expect, type Page } from '@playwright/test';

const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3001';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('banner').getByText(email)).toBeVisible();
}

test('work entries: create, list, edit, delete', async ({ page, request }) => {
  const runId = Date.now();
  const userEmail = `e2e-${runId}@example.com`;
  const clientName = `E2E Client ${runId}`;
  const createdDescription = `Initial work ${runId}`;
  const editedDescription = `Edited work ${runId}`;

  const clientResponse = await request.post(`${apiURL}/api/clients`, {
    headers: { 'x-user-email': userEmail },
    data: { name: clientName },
  });
  expect(clientResponse.ok()).toBeTruthy();

  await test.step('login', async () => {
    await login(page, userEmail);
  });

  await test.step('open work entries', async () => {
    await page.getByRole('navigation').getByRole('button', { name: 'Work Entries' }).first().click();
    await expect(page).toHaveURL(/\/work-entries$/);
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  await test.step('create a work entry', async () => {
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add New Work Entry' });
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName }).click();
    await dialog.getByLabel('Hours').fill('7.5');
    await dialog.getByLabel('Description').fill(createdDescription);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();
  });

  const row = page.getByRole('row').filter({ hasText: clientName });

  await test.step('verify it appears in the list', async () => {
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('7.5 hours');
    await expect(row).toContainText(createdDescription);
    await expect(row).toContainText(new Date().toLocaleDateString('en-US'));
  });

  await test.step('edit it', async () => {
    await row.getByRole('button').nth(0).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Work Entry' });
    await expect(dialog.getByLabel('Hours')).toHaveValue('7.5');
    await dialog.getByLabel('Hours').fill('3.25');
    await dialog.getByLabel('Description').fill(editedDescription);
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText('3.25 hours');
    await expect(row).toContainText(editedDescription);
    await expect(row).not.toContainText(createdDescription);
  });

  await test.step('delete it', async () => {
    page.once('dialog', (confirmDialog) => {
      expect(confirmDialog.message()).toContain(`3.25 hour entry for ${clientName}`);
      confirmDialog.accept();
    });
    await row.getByRole('button').nth(1).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  const remaining = await request.get(`${apiURL}/api/work-entries`, {
    headers: { 'x-user-email': userEmail },
  });
  expect((await remaining.json()).workEntries).toHaveLength(0);
});
