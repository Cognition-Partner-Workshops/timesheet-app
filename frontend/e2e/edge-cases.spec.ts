import { expect, test, createClient } from './fixtures';

test('client form validates empty and whitespace-only names', async ({ authedPage: page }) => {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Client name is required');
  await page.getByLabel('Client Name').fill('   ');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Client name is required');
});

test('work entry form validates client and hours', async ({ authedPage: page }) => {
  const client = `Validation Client ${Date.now()}`;
  await createClient(page, client);
  await page.goto('/work-entries');
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await page.getByLabel('Hours').fill('0');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Please select a client');
  await page.locator('[role="dialog"] [role="combobox"]').click();
  await page.getByRole('option', { name: client }).click();
  for (const [value, message] of [['0', 'Hours must be between 0 and 24'], ['25', 'Hours must be between 0 and 24'], ['abc', 'Hours must be between 0 and 24']] as const) {
    await page.getByLabel('Hours').fill(value);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(message);
  }
});

test('special characters round-trip as text and length limits are enforced', async ({ authedPage: page }) => {
  const special = `O'Brien & Sons <script>alert(1)</script> — üñî 日本語`;
  await createClient(page, special, { description: special });
  await expect(page.getByText(special, { exact: true }).first()).toBeVisible();
  expect(await page.locator('script').evaluateAll((scripts, value) =>
    scripts.some((script) => script.textContent?.includes(value as string)),
    special,
  )).toBe(false);

  const maxName = 'N'.repeat(255);
  await createClient(page, maxName);
  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill(`${maxName}x`);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Validation error');

  const longDescription = 'D'.repeat(1000);
  await page.getByLabel('Client Name').fill('Description Client');
  await page.getByLabel('Description').fill(longDescription);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Description Client' })).toBeVisible();

  await page.getByRole('button', { name: 'Add Client' }).click();
  await page.getByLabel('Client Name').fill('Too Long Description');
  await page.getByRole('dialog').getByLabel('Description').fill(`${longDescription}x`);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Validation error');
});
