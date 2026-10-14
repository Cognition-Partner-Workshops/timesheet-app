import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient } from './helpers';

test.describe('Edge cases', () => {
  test('submitting an empty client form shows validation error', async ({ page }) => {
    await login(page, uniqueEmail('edge-empty-client'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByText('Client name is required')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('submitting a work entry without selecting a client shows error', async ({ page }) => {
    await login(page, uniqueEmail('edge-empty-entry'));
    await createClient(page, 'Edge Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Hours').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByText('Please select a client')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('rejects out-of-range hours', async ({ page }) => {
    await login(page, uniqueEmail('edge-hours'));
    await createClient(page, 'Hours Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client').click();
    await page.getByRole('option', { name: 'Hours Client' }).click();
    const hoursInput = dialog.getByLabel('Hours');
    await hoursInput.evaluate((el: HTMLInputElement) => el.removeAttribute('max'));
    await hoursInput.fill('25');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByText('Hours must be between 0 and 24')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('special characters in client names are handled', async ({ page }) => {
    await login(page, uniqueEmail('edge-special'));
    const name = `O'Brien & Söhne <"Test"> 株式会社`;
    await createClient(page, name);
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  });

  test('very long text in client fields is accepted up to limits', async ({ page }) => {
    await login(page, uniqueEmail('edge-long'));
    const longName = 'L'.repeat(255);
    const longDescription = 'D'.repeat(1000);
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill(longName);
    await dialog.getByLabel('Description').fill(longDescription);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('cell', { name: longName, exact: true })).toBeVisible();
  });

  test('over-limit client name is rejected by the API with an error', async ({ page }) => {
    await login(page, uniqueEmail('edge-toolong'));
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Client Name').fill('X'.repeat(256));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /length|255|validation|failed/i })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });
});
