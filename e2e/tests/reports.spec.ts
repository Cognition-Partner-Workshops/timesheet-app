import { test, expect } from '@playwright/test';
import { uniqueEmail, login, createClient, createWorkEntry } from './helpers';

test.describe('Reporting', () => {
  test('reports show correct totals after creating entries', async ({ page }) => {
    await login(page, uniqueEmail('reports'));
    await createClient(page, 'Report Client');

    await createWorkEntry(page, 'Report Client', '3.25', 'Task one');
    await createWorkEntry(page, 'Report Client', '4.75', 'Task two');

    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Report Client' }).click();

    const totalHoursCard = page.locator('.MuiCard-root', { hasText: 'Total Hours' });
    await expect(totalHoursCard.locator('.MuiTypography-h4')).toHaveText('8.00');
    const entriesCard = page.locator('.MuiCard-root', { hasText: 'Total Entries' });
    await expect(entriesCard.locator('.MuiTypography-h4')).toHaveText('2');
    const avgCard = page.locator('.MuiCard-root', { hasText: 'Average Hours per Entry' });
    await expect(avgCard.locator('.MuiTypography-h4')).toHaveText('4.00');

    await expect(page.getByText('Task one')).toBeVisible();
    await expect(page.getByText('Task two')).toBeVisible();
  });

  test('shows empty state for client with no entries', async ({ page }) => {
    await login(page, uniqueEmail('reports-empty'));
    await createClient(page, 'Empty Client');

    await page.goto('/reports');
    await page.getByLabel('Select Client').click();
    await page.getByRole('option', { name: 'Empty Client' }).click();
    await expect(page.getByText('No work entries found for this client.')).toBeVisible();
  });
});
