import { test, expect } from '@playwright/test';

const uniqueEmail = () => `client-${Date.now()}@example.com`;

test.describe('Client Management', () => {
  test('should create a new client', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').fill('Acme Corp');
    await page.getByLabel('Department').fill('Engineering');
    await page.getByLabel('Email').fill('acme@corp.com');
    await page.getByLabel('Description').fill('Test client for E2E');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');

    // Create a client first
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Edit Me Corp');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Edit Me Corp')).toBeVisible();

    // Click the edit button on the row
    const row = page.getByRole('row').filter({ hasText: 'Edit Me Corp' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="EditIcon"]') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Client Name').clear();
    await page.getByLabel('Client Name').fill('Updated Corp');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Updated Corp')).toBeVisible();
    await expect(page.getByText('Edit Me Corp')).not.toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');

    // Create a client first
    await page.getByRole('button', { name: 'Add Client' }).click();
    await page.getByLabel('Client Name').fill('Delete Me Corp');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Delete Me Corp')).toBeVisible();

    // Handle confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    const row = page.getByRole('row').filter({ hasText: 'Delete Me Corp' });
    await row.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') }).click();

    await expect(page.getByText('Delete Me Corp')).not.toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/clients');
    await expect(page.getByText(/no clients found/i)).toBeVisible();
  });
});
