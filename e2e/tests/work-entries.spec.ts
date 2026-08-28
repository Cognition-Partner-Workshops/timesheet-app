import { test, expect } from '@playwright/test';
import {
  acceptNextConfirm,
  createClient,
  createWorkEntry,
  gotoSection,
  hoursInput,
  login,
  uniqueEmail,
  uniqueName,
} from './helpers';

test.describe('Work entry lifecycle', () => {
  test('creates, lists, edits and deletes a work entry', async ({ page }) => {
    const clientName = uniqueName('Timebox');
    await login(page, uniqueEmail('entries'));

    await gotoSection(page, 'Clients');
    await createClient(page, clientName);

    await gotoSection(page, 'Work Entries');
    await createWorkEntry(page, clientName, '4.5', 'Initial implementation');

    const row = page.getByRole('row', { name: /Initial implementation/ });
    await expect(row).toContainText(clientName);
    await expect(row).toContainText('4.5');

    await row.getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit Work Entry' })).toBeVisible();
    await hoursInput(page).fill('7.25');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();

    const updatedRow = page.getByRole('row', { name: /Initial implementation/ });
    await expect(updatedRow).toContainText('7.25');
    await expect(page.getByRole('row', { name: /4\.5 hours/ })).toHaveCount(0);

    acceptNextConfirm(page);
    await updatedRow.getByRole('button').last().click();

    await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();
  });

  test('entries survive a page reload and show the correct client', async ({ page }) => {
    const clientName = uniqueName('Persist');
    await login(page, uniqueEmail('entries-reload'));

    await gotoSection(page, 'Clients');
    await createClient(page, clientName);
    await gotoSection(page, 'Work Entries');
    await createWorkEntry(page, clientName, '3', 'Reload check');

    await page.reload();
    const row = page.getByRole('row', { name: /Reload check/ });
    await expect(row).toContainText(clientName);
    await expect(row).toContainText('3 hours');
  });

  test('prompts to create a client when none exist', async ({ page }) => {
    await login(page, uniqueEmail('entries-empty'));
    await gotoSection(page, 'Work Entries');

    await expect(page.getByText('You need to create at least one client before adding work entries.')).toBeVisible();
  });
});
