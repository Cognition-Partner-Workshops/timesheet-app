import { test, expect } from '@playwright/test';

test.describe('Logout', () => {
  test('should log out and redirect to login page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Enter your email to log in')).toBeVisible();
  });
});
