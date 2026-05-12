import { type Page, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';

export async function login(page: Page, email = TEST_EMAIL) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
}

export function setupDialogHandler(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
}

export async function clearAllClients(page: Page) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const clearBtn = page.getByRole('button', { name: 'Clear All' });
  if (await clearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await clearBtn.click();
    await expect(clearBtn).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);
  }
}

export async function createClient(
  page: Page,
  name: string,
  opts?: { department?: string; email?: string; description?: string }
) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add Client' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel('Client Name').fill(name);
  if (opts?.department) await page.getByLabel('Department').fill(opts.department);
  if (opts?.email) await page.getByLabel('Email').fill(opts.email);
  if (opts?.description) await page.getByLabel('Description').fill(opts.description);

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
  await expect(page.getByText(name).first()).toBeVisible();
}

export async function navigateToWorkEntries(page: Page) {
  await page.goto('/work-entries');
  await page.waitForLoadState('networkidle');
}

export async function openWorkEntryDialog(page: Page) {
  await page.getByRole('button', { name: 'Add Work Entry' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function fillWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  description: string
) {
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByLabel('Hours').fill(hours);
  await page.getByLabel('Description').fill(description);
}

export async function submitWorkEntry(page: Page) {
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
}

export async function createWorkEntry(
  page: Page,
  clientName: string,
  hours: string,
  description: string
) {
  await openWorkEntryDialog(page);
  await fillWorkEntry(page, clientName, hours, description);
  await submitWorkEntry(page);
}

export async function clickRowAction(page: Page, rowText: string, iconTestId: string) {
  const row = page.getByRole('row').filter({ hasText: rowText });
  await row.getByRole('button').filter({ has: page.locator(`[data-testid="${iconTestId}"]`) }).click();
}

export { TEST_EMAIL };
