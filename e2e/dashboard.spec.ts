import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display all dashboard sections and stats', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Statistic cards
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Total Work Entries')).toBeVisible();
    await expect(page.getByText('Total Hours')).toBeVisible();

    // Sections
    await expect(page.getByText('Recent Work Entries')).toBeVisible();
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('should navigate from dashboard to other pages', async ({ page }) => {
    await page.goto('/dashboard');

    // Click Total Clients card to navigate to clients
    await page.getByText('Total Clients').click();
    await expect(page).toHaveURL(/.*clients/);

    // Go back and click Add Entry
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page).toHaveURL(/.*work-entries/);
  });
});
