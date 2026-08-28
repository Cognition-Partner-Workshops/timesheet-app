// @ts-check
const { expect } = require('@playwright/test');

/**
 * Log in via the UI and wait for the dashboard redirect.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 */
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

module.exports = { login };
