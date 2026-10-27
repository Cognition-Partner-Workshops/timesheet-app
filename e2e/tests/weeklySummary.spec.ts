import { test, expect, type Page } from '@playwright/test';

const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3001';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('banner').getByText(email)).toBeVisible();
}

function getUtcMonday(date: Date): string {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

test('weekly summary shows current week totals and supports week navigation', async ({ page, request }) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userEmail = `weekly-summary-${runId}@example.com`;
  const clientAName = `Weekly Client A ${runId}`;
  const clientBName = `Weekly Client B ${runId}`;
  const weekStart = getUtcMonday(new Date());

  const clientAResponse = await request.post(`${apiURL}/api/clients`, {
    headers: { 'x-user-email': userEmail },
    data: { name: clientAName },
  });
  expect(clientAResponse.ok()).toBeTruthy();
  const clientAId = (await clientAResponse.json()).client.id as number;

  const clientBResponse = await request.post(`${apiURL}/api/clients`, {
    headers: { 'x-user-email': userEmail },
    data: { name: clientBName },
  });
  expect(clientBResponse.ok()).toBeTruthy();
  const clientBId = (await clientBResponse.json()).client.id as number;

  for (let day = 0; day < 4; day += 1) {
    const response = await request.post(`${apiURL}/api/work-entries`, {
      headers: { 'x-user-email': userEmail },
      data: { clientId: clientAId, hours: 7, date: addDays(weekStart, day) },
    });
    expect(response.ok()).toBeTruthy();
  }
  for (let day = 4; day < 6; day += 1) {
    const response = await request.post(`${apiURL}/api/work-entries`, {
      headers: { 'x-user-email': userEmail },
      data: { clientId: clientBId, hours: 7, date: addDays(weekStart, day) },
    });
    expect(response.ok()).toBeTruthy();
  }

  await test.step('login', async () => {
    await login(page, userEmail);
  });

  const weeklyCard = page.locator('.MuiPaper-root').filter({
    has: page.getByRole('heading', { name: 'This week' }),
  });

  await test.step('This week card shows 42 hours and both client totals', async () => {
    await expect(weeklyCard.getByText('42 h', { exact: true })).toBeVisible();
    await expect(
      weeklyCard.getByRole('alert').filter({ hasText: 'Over 40 hours this week (42 h)' })
    ).toBeVisible();
    await expect(weeklyCard.getByText(clientAName)).toBeVisible();
    await expect(weeklyCard.getByText(clientAName).locator('..')).toContainText('28 h');
    await expect(weeklyCard.getByText(clientBName)).toBeVisible();
    await expect(weeklyCard.getByText(clientBName).locator('..')).toContainText('14 h');
  });

  await test.step('Previous week has no hours or warning', async () => {
    await weeklyCard.getByRole('button', { name: 'Previous week' }).click();
    await expect(weeklyCard.getByText('0 h', { exact: true }).first()).toBeVisible();
    await expect(weeklyCard.getByRole('alert').filter({ hasText: 'Over 40 hours' })).toHaveCount(0);
  });

  await test.step('Next week returns to the 42-hour summary', async () => {
    await weeklyCard.getByRole('button', { name: 'Next week' }).click();
    await expect(weeklyCard.getByText('42 h', { exact: true })).toBeVisible();
    await expect(
      weeklyCard.getByRole('alert').filter({ hasText: 'Over 40 hours this week (42 h)' })
    ).toBeVisible();
  });
});
