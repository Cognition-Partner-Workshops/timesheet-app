import { test, expect } from '@playwright/test';
import {
  login,
  resetBackend,
  apiCreateClient,
  openDialogAndFillForm,
  selectMuiOption,
} from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await resetBackend();
    await login(page);
  });

  test('should reject empty client name on create', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/clients');
    await openDialogAndFillForm(page, 'Add Client', 'Add New Client', {
      'Client Name': "O'Brien & Co. <div>test</div>",
    });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(
      page.getByRole('cell', { name: "O'Brien & Co. <div>test</div>" })
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle very long text in client description', async ({ page }) => {
    await page.goto('/clients');
    await openDialogAndFillForm(page, 'Add Client', 'Add New Client', {
      'Client Name': 'Long Desc Client',
      Description: 'A'.repeat(500),
    });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('cell', { name: 'Long Desc Client' })).toBeVisible({ timeout: 5000 });
  });

  test('should reject work entry with no client selected', async ({ page }) => {
    await apiCreateClient('Some Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await page.getByLabel('Hours').fill('2');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(/select a client/i)).toBeVisible({ timeout: 5000 });
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    await apiCreateClient('Hours Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectMuiOption(page, 'Hours Client');
    await page.getByLabel('Hours').fill('0');
    await page.getByRole('button', { name: 'Create' }).click();
    // Browser HTML5 validation prevents form submit (min=0.01). Dialog stays open.
    await expect(page.getByText('Add New Work Entry')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await apiCreateClient('Special Desc Client');
    await page.goto('/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectMuiOption(page, 'Special Desc Client');
    await page.getByLabel('Hours').fill('1');
    const specialDesc = "Code review: <div>test</div> & 'fixes' \"bugs\"";
    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(specialDesc)).toBeVisible({ timeout: 5000 });
  });

  test('should reject description exceeding max length', async ({ page }) => {
    await page.goto('/clients');
    await openDialogAndFillForm(page, 'Add Client', 'Add New Client', {
      'Client Name': 'Overflow Client',
      Description: 'B'.repeat(1001),
    });
    await page.getByRole('button', { name: 'Create' }).click();
    // Backend validates max 1000 chars; dialog stays open
    await page.waitForTimeout(2000);
    await expect(page.getByText('Add New Client')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('cell', { name: 'Overflow Client' })).not.toBeVisible({ timeout: 3000 });
  });
});
