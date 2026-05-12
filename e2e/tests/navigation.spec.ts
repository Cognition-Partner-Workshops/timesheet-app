import { test, expect } from '@playwright/test';
import { navigateViaSidebar } from '../fixtures/auth';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await navigateViaSidebar(page, 'Clients');
    await expect(page).toHaveURL(/\/clients/);

    await navigateViaSidebar(page, 'Dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('should navigate to Clients page', async ({ page }) => {
    await navigateViaSidebar(page, 'Clients');
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();
  });

  test('should navigate to Work Entries page', async ({ page }) => {
    await navigateViaSidebar(page, 'Work Entries');
    await expect(page).toHaveURL(/\/work-entries/);
    await expect(page.locator('h4').filter({ hasText: 'Work Entries' })).toBeVisible();
  });

  test('should navigate to Reports page', async ({ page }) => {
    await navigateViaSidebar(page, 'Reports');
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator('h4').filter({ hasText: 'Reports' })).toBeVisible();
  });
});
