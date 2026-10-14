import { test, expect } from '@playwright/test';
import {
  acceptNextConfirm,
  createClient,
  createWorkEntry,
  gotoSection,
  login,
  uniqueEmail,
  uniqueName,
} from './helpers';

const summaryCard = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.MuiCard-root').filter({ hasText: title });

test.describe('Reporting', () => {
  test('report totals reflect the entries created and deleted', async ({ page }) => {
    const clientName = uniqueName('Reported');
    await login(page, uniqueEmail('reports'));

    await gotoSection(page, 'Clients');
    await createClient(page, clientName);

    await gotoSection(page, 'Work Entries');
    await createWorkEntry(page, clientName, '2.5', 'Discovery');
    await createWorkEntry(page, clientName, '3.25', 'Build');

    await gotoSection(page, 'Reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName, exact: true }).click();

    await expect(summaryCard(page, 'Total Hours')).toContainText('5.75');
    await expect(summaryCard(page, 'Total Entries')).toContainText('2');
    await expect(summaryCard(page, 'Average Hours per Entry')).toContainText('2.88');
    await expect(page.getByRole('row', { name: /Discovery/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Build/ })).toBeVisible();

    await gotoSection(page, 'Work Entries');
    acceptNextConfirm(page);
    await page.getByRole('row', { name: /Discovery/ }).getByRole('button').last().click();
    await expect(page.getByRole('row', { name: /Discovery/ })).toHaveCount(0);

    await gotoSection(page, 'Reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName, exact: true }).click();

    await expect(summaryCard(page, 'Total Hours')).toContainText('3.25');
    await expect(summaryCard(page, 'Total Entries')).toContainText('1');
  });

  test('CSV export contains the entry with a calendar date', async ({ page }) => {
    const clientName = uniqueName('Exported');
    await login(page, uniqueEmail('reports-csv'));

    await gotoSection(page, 'Clients');
    await createClient(page, clientName);
    await gotoSection(page, 'Work Entries');
    await createWorkEntry(page, clientName, '6', 'Exportable work');

    await gotoSection(page, 'Reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName, exact: true }).click();
    await expect(summaryCard(page, 'Total Hours')).toContainText('6.00');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has(svg[data-testid="DescriptionIcon"])').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    const stream = await download.createReadStream();
    const csv = (await new Response(stream as unknown as ReadableStream).text()).trim();
    expect(csv.split('\n')[0]).toBe('Date,Hours,Description,Created At');
    expect(csv).toContain('Exportable work');
    expect(csv).toMatch(/\d{4}-\d{2}-\d{2},6/);
  });

  test('report shows an empty state for a client without entries', async ({ page }) => {
    const clientName = uniqueName('Idle');
    await login(page, uniqueEmail('reports-empty'));

    await gotoSection(page, 'Clients');
    await createClient(page, clientName);
    await gotoSection(page, 'Reports');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: clientName, exact: true }).click();

    await expect(summaryCard(page, 'Total Hours')).toContainText('0.00');
    await expect(page.getByText('No work entries found for this client.')).toBeVisible();
  });
});
