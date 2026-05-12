import { test, expect } from '@playwright/test';
import { sidebarButton } from './helpers';

test.describe('Navigation', () => {
  test('should display sidebar items and navigate to all pages', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify sidebar navigation items
    await expect(sidebarButton(page, 'Dashboard')).toBeVisible();
    await expect(sidebarButton(page, 'Clients')).toBeVisible();
    await expect(sidebarButton(page, 'Work Entries')).toBeVisible();
    await expect(sidebarButton(page, 'Reports')).toBeVisible();

    // Navigate to Clients
    await sidebarButton(page, 'Clients').click();
    await expect(page).toHaveURL(/.*clients/);
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    // Navigate to Work Entries
    await sidebarButton(page, 'Work Entries').click();
    await expect(page).toHaveURL(/.*work-entries/);
    await expect(page.getByRole('heading', { name: 'Work Entries', exact: true })).toBeVisible();

    // Navigate to Reports
    await sidebarButton(page, 'Reports').click();
    await expect(page).toHaveURL(/.*reports/);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    // Navigate back to Dashboard
    await sidebarButton(page, 'Dashboard').click();
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should highlight active navigation item and show app title', async ({ page }) => {
    await page.goto('/dashboard');

    // App title in sidebar
    await expect(page.locator('nav').getByText('Time Tracker')).toBeVisible();

    // Dashboard should be selected
    await expect(sidebarButton(page, 'Dashboard')).toHaveClass(/Mui-selected/);

    // Navigate to Clients and verify selection changes
    await sidebarButton(page, 'Clients').click();
    await expect(sidebarButton(page, 'Clients')).toHaveClass(/Mui-selected/);
  });

  test('should redirect root path to dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
