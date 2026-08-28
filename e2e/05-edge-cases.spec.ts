import { test, expect } from '@playwright/test';
import { login, apiClearAllClients, navigateTo, openAddClientDialog, createClient, createWorkEntry, fillDatePicker } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
  });

  test('should reject empty client name on form submission', async ({ page }) => {
    await openAddClientDialog(page);
    await page.getByRole('button', { name: 'Create' }).click();

    const dialogStillOpen = await page.getByText('Add New Client').isVisible();
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorShown).toBe(true);
  });

  test('should reject empty work entry form submission', async ({ page }) => {
    await createClient(page, 'Edge Client');
    await navigateTo(page, '/work-entries');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    await page.getByRole('button', { name: 'Create' }).click();

    const dialogStillOpen = await page.getByText('Add New Work Entry').isVisible();
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorShown).toBe(true);
  });

  test('should handle special characters in client name', async ({ page }) => {
    await createClient(page, "O'Brien & Associates <LLC>");
    await expect(page.getByText("O'Brien & Associates <LLC>")).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    await createClient(page, 'Spec Char Client');
    const specialDesc = 'Reviewed "code" & fixed <bugs> (100% done)';
    await createWorkEntry(page, 'Spec Char Client', '2', '03/01/2025', specialDesc);
    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    await openAddClientDialog(page);
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill('A'.repeat(500));
    await page.getByRole('button', { name: 'Create' }).click();

    await page.waitForTimeout(2000);
    const dialogGone = !(await page.getByRole('dialog').isVisible());
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogGone || errorShown).toBe(true);

    if (dialogGone) {
      await expect(page.getByText('Long Desc Client')).toBeVisible();
    }
  });

  test('should handle very long client name', async ({ page }) => {
    await openAddClientDialog(page);
    await page.getByLabel('Client Name').fill('B'.repeat(300));
    await page.getByRole('button', { name: 'Create' }).click();

    const errorShown = await page.getByRole('alert').isVisible({ timeout: 5000 }).catch(() => false);
    const dialogStillOpen = await page.getByText('Add New Client').isVisible();
    expect(errorShown || dialogStillOpen).toBe(true);
  });

  test('should cancel client creation dialog', async ({ page }) => {
    await openAddClientDialog(page);
    await page.getByLabel('Client Name').fill('Should Not Be Created');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Should Not Be Created')).toBeHidden();
  });

  test('should handle invalid email in login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('plaintext');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /failed|error|invalid/i })).toBeVisible({ timeout: 5000 });
  });
});
