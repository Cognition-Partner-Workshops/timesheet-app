import { test, expect } from '@playwright/test';
import { login, cleanupViaApi } from './helpers';

async function selectReportClient(page: import('@playwright/test').Page, clientName: string) {
  await page.locator('.MuiFormControl-root', { hasText: 'Select Client' }).locator('[role="combobox"]').click();
  await page.getByRole('option', { name: clientName }).click();
}

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await cleanupViaApi(page);

    // Create client and work entries via API
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'x-user-email': email };

      const clientRes = await fetch('/api/clients', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Report Client' }),
      });
      const clientData = await clientRes.json();
      const clientId = clientData.client.id;

      const today = new Date().toISOString().split('T')[0];
      for (const entry of [
        { hours: 3, description: 'Task A' },
        { hours: 5.5, description: 'Task B' },
        { hours: 2, description: 'Task C' },
      ]) {
        await fetch('/api/work-entries', {
          method: 'POST',
          headers,
          body: JSON.stringify({ clientId, ...entry, date: today }),
        });
      }
    });
  });

  test('should show correct totals in report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await selectReportClient(page, 'Report Client');

    // Wait for report to load
    await expect(page.getByText('Total Hours')).toBeVisible({ timeout: 10000 });

    // 3 + 5.5 + 2 = 10.5
    await expect(page.getByText('10.50')).toBeVisible();
    // 3 entries - check in the Total Entries card
    const entriesCard = page.locator('.MuiCard-root', { hasText: 'Total Entries' });
    await expect(entriesCard.getByText('3')).toBeVisible();
    // avg = 10.5/3 = 3.50
    await expect(page.getByText('3.50')).toBeVisible();

    // Verify individual entries
    await expect(page.getByText('Task A')).toBeVisible();
    await expect(page.getByText('Task B')).toBeVisible();
    await expect(page.getByText('Task C')).toBeVisible();
  });

  test('should show no entries message for client with no work', async ({ page }) => {
    // Create an empty client via API
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': email },
        body: JSON.stringify({ name: 'Empty Client' }),
      });
    });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await selectReportClient(page, 'Empty Client');

    await expect(page.getByText('0.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No work entries found for this client')).toBeVisible();
  });

  test('should prompt to select client when none selected', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Select a client to view their time report')).toBeVisible();
  });

  test('should update totals after adding more entries', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await selectReportClient(page, 'Report Client');
    await expect(page.getByText('10.50')).toBeVisible({ timeout: 10000 });

    // Add another entry via API
    await page.evaluate(async () => {
      const email = localStorage.getItem('userEmail')!;
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'x-user-email': email };

      const res = await fetch('/api/clients', { headers: { 'x-user-email': email } });
      const data = await res.json();
      const clientId = data.clients.find((c: { name: string }) => c.name === 'Report Client').id;

      await fetch('/api/work-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId,
          hours: 4.5,
          description: 'Task D',
          date: new Date().toISOString().split('T')[0],
        }),
      });
    });

    // Reload reports page to get updated data
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await selectReportClient(page, 'Report Client');
    await expect(page.getByText('15.00')).toBeVisible({ timeout: 10000 });
  });
});
