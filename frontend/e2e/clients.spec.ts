import { expect, test, createClient } from './fixtures';

test('creates, edits, reloads, and deletes a client', async ({ authedPage: page }) => {
  const originalName = `Acme ${Date.now()}`;
  await createClient(page, originalName, {
    department: 'Engineering',
    email: 'contact@acme.com',
    description: 'Initial description',
  });
  const row = page.getByRole('row').filter({ hasText: originalName });
  await expect(row).toContainText('Engineering');
  await expect(row).toContainText('contact@acme.com');
  await expect(row).toContainText('Initial description');

  const updatedName = `${originalName} Updated`;
  await row.getByRole('button', { name: `Edit client ${originalName}` }).click();
  await page.getByLabel('Client Name').fill(updatedName);
  await page.getByLabel('Department').fill('Product');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: updatedName })).toContainText('Product');

  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: updatedName })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('row').filter({ hasText: updatedName })
    .getByRole('button', { name: `Delete client ${updatedName}` }).click();
  await expect(page.getByText('No clients found. Create your first client to get started.')).toBeVisible();
});
