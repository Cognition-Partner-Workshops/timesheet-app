import { Page, expect } from '@playwright/test';

/**
 * Log in through the real UI (email-only, passwordless auth) and wait until the
 * authenticated Dashboard is shown.
 */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Navigate to a section using the sidebar navigation. */
export async function gotoSection(
  page: Page,
  name: 'Dashboard' | 'Clients' | 'Work Entries' | 'Reports'
): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

/**
 * Select an option from the (single) MUI Select shown in the current view.
 * MUI's Select does not expose an accessible name on its combobox, so we target
 * it by role and pick the option by its visible text.
 */
export async function selectMuiOption(page: Page, optionName: string): Promise<void> {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}
