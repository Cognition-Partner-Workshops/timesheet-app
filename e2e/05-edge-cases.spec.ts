import { test, expect } from '@playwright/test';
import { login, apiClearAllClients } from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page, request }) => {
    await apiClearAllClients(request);
    await login(page);
  });

  test('should reject empty client name on form submission', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    // Try to submit with empty name
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should remain open (form not submitted) or show error
    const dialogStillOpen = await page.getByText('Add New Client').isVisible();
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorShown).toBe(true);
  });

  test('should reject empty work entry form submission', async ({ page }) => {
    // Create a client first
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Edge Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show validation error or remain on dialog
    const dialogStillOpen = await page.getByText('Add New Work Entry').isVisible();
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);
    expect(dialogStillOpen || errorShown).toBe(true);
  });

  test('should handle special characters in client name', async ({ page }) => {
    const specialName = "O'Brien & Associates <LLC>";

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Verify the client name displays correctly with special characters
    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    // Create a client first
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Spec Char Client');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    // Create work entry with special chars in description
    const specialDesc = 'Reviewed "code" & fixed <bugs> (100% done)';
    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Spec Char Client' }).click();
    await page.getByLabel('Hours').fill('2');

    // Fill date using MUI DatePicker sections
    await page.getByRole('dialog').getByLabel('Month').click();
    await page.getByRole('dialog').getByLabel('Month').fill('03');
    await page.getByRole('dialog').getByLabel('Day').fill('01');
    await page.getByRole('dialog').getByLabel('Year').fill('2025');

    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should handle very long text in client description', async ({ page }) => {
    const longText = 'A'.repeat(500);

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill(longText);
    await page.getByRole('button', { name: 'Create' }).click();

    // Should either create successfully or show validation error
    await page.waitForTimeout(2000);
    const dialogGone = !(await page.getByRole('dialog').isVisible());
    const errorShown = await page.getByRole('alert').isVisible().catch(() => false);

    expect(dialogGone || errorShown).toBe(true);

    if (dialogGone) {
      await expect(page.getByText('Long Desc Client')).toBeVisible();
    }
  });

  test('should handle very long client name', async ({ page }) => {
    const longName = 'B'.repeat(300);

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill(longName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show a validation error because max length is 255
    const errorShown = await page.getByRole('alert').isVisible({ timeout: 5000 }).catch(() => false);
    const dialogStillOpen = await page.getByText('Add New Client').isVisible();

    expect(errorShown || dialogStillOpen).toBe(true);
  });

  test('should cancel client creation dialog', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    await page.getByLabel('Client Name').fill('Should Not Be Created');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Should Not Be Created')).toBeHidden();
  });

  test('should handle invalid email in login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('plaintext');
    await page.getByRole('button', { name: 'Log In' }).click();

    // Should show an error
    await expect(page.getByRole('alert').filter({ hasText: /failed|error|invalid/i })).toBeVisible({ timeout: 5000 });
  });
});
