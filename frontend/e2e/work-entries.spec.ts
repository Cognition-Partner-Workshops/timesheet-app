import { expect, test, createClient, addWorkEntry } from './fixtures';

test('shows the empty state when no clients exist', async ({ authedPage: page }) => {
  await page.goto('/work-entries');
  await expect(page.getByText('You need to create at least one client before adding work entries.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create Client' })).toBeVisible();
});

test('creates, edits, and deletes a work entry', async ({ authedPage: page }) => {
  const client = `Work Client ${Date.now()}`;
  await createClient(page, client);
  await page.goto('/work-entries');
  await addWorkEntry(page, client, '4.5', 'Implementation work');
  const row = page.getByRole('row').filter({ hasText: client });
  await expect(row).toContainText('4.5 hours');
  await expect(row).toContainText('Implementation work');

  await row.getByRole('button', { name: `Edit work entry for ${client}` }).click();
  await page.getByLabel('Hours').fill('6');
  const updateResponse = page.waitForResponse(
    (response) => response.url().includes('/api/work-entries/') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  expect((await updateResponse).status()).toBe(200);
  await page.goto('/work-entries');
  await expect(page.getByRole('row').filter({ hasText: client })).toContainText('6 hours');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('row').filter({ hasText: client })
    .getByRole('button', { name: `Delete work entry for ${client}` }).click();
  await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();
});

test('deleting a client removes its work entries', async ({ authedPage: page }) => {
  const client = `Cascade Client ${Date.now()}`;
  const retainedClient = `Retained Client ${Date.now()}`;
  await createClient(page, client);
  await createClient(page, retainedClient);
  await page.goto('/work-entries');
  await addWorkEntry(page, client, '2', 'Cascade entry');
  await page.goto('/clients');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('row').filter({ hasText: client })
    .getByRole('button', { name: `Delete client ${client}` }).click();
  await page.goto('/work-entries');
  await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();
  await expect(page.getByText('Cascade entry')).toHaveCount(0);
});
