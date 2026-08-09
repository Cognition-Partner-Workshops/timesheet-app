import { expect, test, createClient, addWorkEntry } from './fixtures';

test('reports totals update after edit and delete, and CSV exports entries', async ({ authedPage: page }) => {
  const client = `Report Client ${Date.now()}`;
  await createClient(page, client);
  await page.goto('/work-entries');
  await addWorkEntry(page, client, '2.5', 'First');
  await addWorkEntry(page, client, '3.25', 'Second');
  await addWorkEntry(page, client, '4', 'Third');

  await page.goto('/reports');
  await expect(page.locator('[role="combobox"]')).toBeVisible();
  await page.locator('[role="combobox"]').click();
  await page.getByRole('option', { name: client }).click();
  await expect(page.getByText('9.75', { exact: true })).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByText('3.25', { exact: true })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(4);
  await expect(page.getByRole('row').filter({ hasText: 'First' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Second' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Third' })).toBeVisible();

  await page.goto('/work-entries');
  const second = page.getByRole('row').filter({ hasText: 'Second' });
  await second.getByRole('button', { name: `Edit work entry for ${client}` }).click();
  await page.getByLabel('Hours').fill('5');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Second' })).toContainText('5 hours');
  await page.goto('/reports');
  await expect(page.locator('[role="combobox"]')).toBeVisible();
  await page.locator('[role="combobox"]').click();
  await page.getByRole('option', { name: client }).click();
  await expect(page.getByText('11.50', { exact: true })).toBeVisible();
  await expect(page.getByText('3.83', { exact: true })).toBeVisible();

  await page.goto('/work-entries');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('row').filter({ hasText: 'First' })
    .getByRole('button', { name: `Delete work entry for ${client}` }).click();
  await expect(page.getByRole('row').filter({ hasText: 'First' })).toHaveCount(0);
  await page.goto('/reports');
  await expect(page.locator('[role="combobox"]')).toBeVisible();
  await page.locator('[role="combobox"]').click();
  await page.getByRole('option', { name: client }).click();
  await expect(page.getByText('9.00', { exact: true })).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();
  await expect(page.getByText('4.50', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export as CSV' }).click();
  const download = await downloadPromise;
  const contents = await download.path().then(async (path) => {
    const { readFile } = await import('node:fs/promises');
    return readFile(path!, 'utf8');
  });
  expect(contents).toContain('Second');
  expect(contents).toContain('Third');
});
