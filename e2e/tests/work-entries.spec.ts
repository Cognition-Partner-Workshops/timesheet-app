import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry } from './helpers';

test.describe('Work entry lifecycle', () => {
  test('create, verify, edit hours, and delete a work entry', async ({ page }) => {
    await login(page, uniqueEmail('entries'));
    await createClient(page, 'Entry Client');

    await createWorkEntry(page, 'Entry Client', '5.5', 'Initial work');
    const row = page.getByRole('row', { name: /Entry Client/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('5.5 hours');
    await expect(row).toContainText('Initial work');

    await row.getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Edit Work Entry')).toBeVisible();
    await dialog.getByLabel('Hours').fill('8');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row', { name: /Entry Client/ })).toContainText('8 hours');

    page.once('dialog', (d) => d.accept());
    await page.getByRole('row', { name: /Entry Client/ }).getByRole('button').nth(1).click();
    await expect(page.getByText('No work entries found')).toBeVisible();
  });

  test('prompts to create a client when none exist', async ({ page }) => {
    await login(page, uniqueEmail('entries-noclient'));
    await page.goto('/work-entries');
    await expect(
      page.getByText('You need to create at least one client before adding work entries.')
    ).toBeVisible();
  });
});
