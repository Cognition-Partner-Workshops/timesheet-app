import { test, expect } from '@playwright/test';
import {
  alertText,
  createClient,
  createWorkEntry,
  gotoSection,
  hoursInput,
  login,
  selectClientInDialog,
  uniqueEmail,
  uniqueName,
} from './helpers';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Edge cases', () => {
  test('login button is disabled with an empty email', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log In' })).toBeDisabled();
  });

  test('blank client name shows a validation error', async ({ page }) => {
    await login(page, uniqueEmail('edge-client-empty'));
    await gotoSection(page, 'Clients');

    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill('   ');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(alertText(page)).toContainText('Client name is required');
    await expect(dialog).toBeVisible();
  });

  test('work entry without a client selected shows a validation error', async ({ page }) => {
    const clientName = uniqueName('EdgeEntry');
    await login(page, uniqueEmail('edge-entry-empty'));
    await gotoSection(page, 'Clients');
    await createClient(page, clientName);
    await gotoSection(page, 'Work Entries');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await hoursInput(page).fill('5');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(alertText(page)).toContainText('Please select a client');
    await expect(dialog).toBeVisible();
  });

  test('hours above the 24 hour maximum are not accepted', async ({ page }) => {
    const clientName = uniqueName('EdgeHours');
    await login(page, uniqueEmail('edge-hours'));
    await gotoSection(page, 'Clients');
    await createClient(page, clientName);
    await gotoSection(page, 'Work Entries');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await selectClientInDialog(page, clientName);
    const hours = hoursInput(page);
    await hours.fill('25');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).toBeVisible();
    expect(await hours.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();
  });

  test('special characters are preserved in client and entry text', async ({ page }) => {
    const name = `${uniqueName('Ünïcødé')} & <Söns> "Ltd" 100%`;
    const description = "Quote ' and semicolon ; DROP TABLE clients; -- 日本語";
    await login(page, uniqueEmail('edge-special'));

    await gotoSection(page, 'Clients');
    await createClient(page, name, { description });
    await expect(page.getByRole('row', { name: new RegExp(escapeRegex(name)) })).toContainText(description);

    await gotoSection(page, 'Work Entries');
    await createWorkEntry(page, name, '1.5', description);
    await expect(page.getByRole('row', { name: new RegExp(escapeRegex(description)) })).toContainText(name);

    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(escapeRegex(description)) })).toBeVisible();
  });

  test('over-long client name and description are rejected by validation', async ({ page }) => {
    await login(page, uniqueEmail('edge-long'));
    await gotoSection(page, 'Clients');

    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill('N'.repeat(300));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(alertText(page)).toContainText(/Validation error|name/i);

    await dialog.getByLabel('Client Name').fill(uniqueName('LongDesc'));
    await dialog.getByLabel('Description').fill('D'.repeat(1500));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(alertText(page)).toContainText(/Validation error|description/i);
    await expect(dialog).toBeVisible();
  });

  test('long but allowed text is accepted and displayed', async ({ page }) => {
    const name = uniqueName('LongOk');
    const description = 'L'.repeat(900);
    await login(page, uniqueEmail('edge-long-ok'));

    await gotoSection(page, 'Clients');
    await createClient(page, name, { description });
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(description);
  });
});
