import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = 'a11y-test@example.com';
const API_BASE = 'http://localhost:3001';

interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  helpUrl: string;
  nodes: { html: string; failureSummary: string; target: string[] }[];
}

interface PageResult {
  pageName: string;
  violations: AxeViolation[];
  passes: number;
}

const allResults: PageResult[] = [];

function collectViolations(violations: AxeViolation[], passes: number, pageName: string) {
  allResults.push({ pageName, violations, passes });

  if (violations.length === 0) {
    console.log(`[PASS] ${pageName}: 0 violations, ${passes} rules passed`);
    return;
  }

  const summary = violations.map((v) => {
    const nodeInfo = v.nodes
      .slice(0, 3)
      .map((n) => `      HTML: ${n.html}\n      Fix: ${n.failureSummary}`)
      .join('\n');
    return `  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n    ${v.helpUrl}\n${nodeInfo}`;
  });

  console.log(
    `\n=== Accessibility Violations on ${pageName} (${violations.length} violations, ${passes} passed) ===\n${summary.join('\n\n')}\n`
  );
}

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email Address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function runAxeAudit(page: Page, pageName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  collectViolations(results.violations, results.passes.length, pageName);
  return results;
}

test.describe('Accessibility Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser, playwright }) => {
    const request = await playwright.request.newContext();
    await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: TEST_EMAIL },
    });
    await request.delete(`${API_BASE}/api/clients`, {
      headers: { 'x-user-email': TEST_EMAIL },
    });
    await request.dispose();

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async ({ playwright }) => {
    await context.close();
    // Clean up test data
    const request = await playwright.request.newContext();
    await request.delete(`${API_BASE}/api/clients`, {
      headers: { 'x-user-email': TEST_EMAIL },
    });
    await request.dispose();
  });

  test('Login page accessibility', async () => {
    await page.goto('/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();

    const results = await runAxeAudit(page, 'Login Page');

    expect(
      results.violations,
      `Login page has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Dashboard page accessibility', async () => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const results = await runAxeAudit(page, 'Dashboard Page');

    expect(
      results.violations,
      `Dashboard page has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Clients page accessibility - empty state', async () => {
    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForURL('**/clients');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    const results = await runAxeAudit(page, 'Clients Page (empty)');

    expect(
      results.violations,
      `Clients page (empty) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Clients page accessibility - Add Client dialog', async () => {
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).toBeVisible();
    // Wait for MUI dialog transition to fully complete
    await page.waitForTimeout(500);

    const results = await runAxeAudit(page, 'Add Client Dialog');

    // Create a client for subsequent tests (before assertion, so tests continue)
    await page.getByLabel('Client Name').fill('A11y Test Corp');
    await page.getByLabel('Department').fill('QA');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Client' })).not.toBeVisible();

    expect(
      results.violations,
      `Add Client dialog has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Clients page accessibility - with data', async () => {
    await expect(page.getByRole('cell', { name: 'A11y Test Corp', exact: true })).toBeVisible();

    const results = await runAxeAudit(page, 'Clients Page (with data)');

    expect(
      results.violations,
      `Clients page (with data) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Work Entries page accessibility - empty state', async () => {
    await page.getByRole('button', { name: 'Work Entries' }).click();
    await page.waitForURL('**/work-entries');
    await expect(page.getByRole('heading', { name: 'Work Entries' })).toBeVisible();

    const results = await runAxeAudit(page, 'Work Entries Page (empty)');

    expect(
      results.violations,
      `Work Entries page (empty) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Work Entries page accessibility - Add Work Entry dialog', async () => {
    await page.getByRole('button', { name: 'Add Work Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Work Entry' })).toBeVisible();
    // Wait for MUI dialog transition to fully complete
    await page.waitForTimeout(500);

    const results = await runAxeAudit(page, 'Add Work Entry Dialog');

    // Create an entry for subsequent tests (before assertion)
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'A11y Test Corp' }).click();
    await dialog.getByRole('spinbutton', { name: 'Hours' }).fill('4');
    await dialog.getByRole('textbox', { name: 'Description' }).fill('Accessibility testing');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    expect(
      results.violations,
      `Add Work Entry dialog has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Work Entries page accessibility - with data', async () => {
    await expect(page.getByText('A11y Test Corp').first()).toBeVisible();

    const results = await runAxeAudit(page, 'Work Entries Page (with data)');

    expect(
      results.violations,
      `Work Entries page (with data) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Reports page accessibility - no client selected', async () => {
    await page.getByRole('button', { name: 'Reports' }).click();
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    const results = await runAxeAudit(page, 'Reports Page (no client selected)');

    expect(
      results.violations,
      `Reports page (no selection) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });

  test('Reports page accessibility - with client selected', async () => {
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'A11y Test Corp' }).click();
    await expect(page.getByText('Total Hours')).toBeVisible();

    const results = await runAxeAudit(page, 'Reports Page (with client)');

    expect(
      results.violations,
      `Reports page (with client) has ${results.violations.length} accessibility violation(s)`
    ).toEqual([]);
  });
});
