import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display dashboard stats cards', async ({ page }) => {
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Total Work Entries')).toBeVisible();
    await expect(page.getByText('Total Hours')).toBeVisible();
  });

  test('should display recent work entries section', async ({ page }) => {
    await expect(page.getByText('Recent Work Entries')).toBeVisible();
  });

  test('should display quick actions section', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('should have an Add Entry button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Entry' })).toBeVisible();
  });
});
