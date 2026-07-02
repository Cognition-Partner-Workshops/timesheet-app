import { test, expect } from '@playwright/test';
import { login, cleanupViaApi, TEST_EMAIL } from './helpers';

async function selectClient(page: import('@playwright/test').Page, clientName: string) {
  await page.locator('.MuiFormControl-root', { hasText: 'Client' }).locator('[role="combobox"]').click();
  await page.getByRole('option', { name: clientName }).click();
}

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await cleanupViaApi(page);
  });

  test('should reject empty client name (form validation)', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByText('Add New Client')).toBeVisible();

    // Leave name empty, try to submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Dialog should still be open (HTML5 required prevents submit)
    await expect(page.getByText('Add New Client')).toBeVisible();
  });

  test('should handle special characters in client name', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const specialName = 'Cl!ent <With> "Special" & \'Chars\' @#$%';

    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill(specialName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Client')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText(specialName)).toBeVisible();
  });

  test('should handle very long text in description', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const longText = 'A'.repeat(500);

    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Long Desc Client');
    await page.getByLabel('Description').fill(longText);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Client')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Long Desc Client')).toBeVisible();
  });

  test('should reject work entry with zero hours', async ({ page }) => {
    // Create a client via API
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ name: 'Hours Test Client' }),
      });
    });

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectClient(page, 'Hours Test Client');
    await page.getByLabel('Hours').fill('0');
    await page.getByLabel('Description').fill('Zero hour test');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show validation error or dialog stays open
    const dialogStillOpen = await page
      .getByText('Add New Work Entry')
      .isVisible()
      .catch(() => false);
    const errorShown = await page
      .getByRole('alert')
      .filter({ hasText: /hour|error/i })
      .isVisible()
      .catch(() => false);
    expect(dialogStillOpen || errorShown).toBeTruthy();
  });

  test('should reject work entry without selecting a client', async ({ page }) => {
    // Create a client so the form shows
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ name: 'Dummy Client' }),
      });
    });

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await page.getByLabel('Hours').fill('5');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show validation error or dialog stays open
    const dialogStillOpen = await page
      .getByText('Add New Work Entry')
      .isVisible()
      .catch(() => false);
    const errorShown = await page
      .getByRole('alert')
      .filter({ hasText: /client|error/i })
      .isVisible()
      .catch(() => false);
    expect(dialogStillOpen || errorShown).toBeTruthy();
  });

  test('should handle special characters in work entry description', async ({ page }) => {
    // Create a client via API
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ name: 'Desc Test Client' }),
      });
    });

    await page.goto('/work-entries');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await selectClient(page, 'Desc Test Client');
    await page.getByLabel('Hours').fill('1');

    const specialDesc = 'Worked on <script>alert("xss")</script> & "quotes"';
    await page.getByLabel('Description').fill(specialDesc);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Add New Work Entry')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText(specialDesc)).toBeVisible();
  });

  test('should preserve data isolation between users', async ({ page }) => {
    // Create a client as user 1
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ name: 'User1 Client' }),
      });
    });

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('User1 Client')).toBeVisible();

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 10000 });

    // Login as different user
    await page.getByLabel('Email Address').fill('other-user@example.com');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Other user should NOT see User1's client
    await expect(page.getByText('User1 Client')).not.toBeVisible();
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});
