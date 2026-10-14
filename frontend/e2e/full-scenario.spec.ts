import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const CLIENT_NAME = 'E2E Test Client';
const CLIENT_DEPARTMENT = 'Engineering';
const CLIENT_EMAIL = 'client@example.com';
const CLIENT_DESCRIPTION = 'Created by E2E test';
const WORK_HOURS = '3.5';
const WORK_DESCRIPTION = 'E2E test work entry';
const UPDATED_WORK_HOURS = '5';
const UPDATED_WORK_DESCRIPTION = 'Updated E2E test work entry';

test.describe.serial('Full user scenario', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================
  // Step 1: ログイン
  // ============================================
  test('Step 1: ログインしてダッシュボードに遷移する', async () => {
    await page.goto('/login');

    // LoginPage の要素を確認
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByText('Enter your email to log in')).toBeVisible();

    // メール入力してログイン
    await page.getByLabel('Email Address').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Log In' }).click();

    // ダッシュボードに遷移することを確認
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // ヘッダーにメールアドレスが表示されることを確認
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  // ============================================
  // Step 2: ダッシュボード初期状態の確認
  // ============================================
  test('Step 2: ダッシュボードの初期状態を確認する', async () => {
    // 統計カードが表示される（初期値は0）
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Total Work Entries')).toBeVisible();
    await expect(page.getByText('Total Hours')).toBeVisible();

    // "No work entries yet" が表示される
    await expect(page.getByText('No work entries yet')).toBeVisible();

    // Quick Actions が表示される
    await expect(page.getByRole('button', { name: 'Add Client' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Work Entry' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Reports' })).toBeVisible();
  });

  // ============================================
  // Step 3: クライアント作成
  // ============================================
  test('Step 3: サイドバーからClientsページに遷移してクライアントを作成する', async () => {
    // サイドバーの "Clients" をクリック
    await page.getByRole('link', { name: 'Clients' }).or(page.locator('text=Clients').first()).click();
    await page.waitForURL('**/clients');

    // 空状態メッセージを確認
    await expect(page.getByText('No clients found. Create your first client to get started.')).toBeVisible();

    // "Add Client" ボタンをクリック
    await page.getByRole('button', { name: 'Add Client' }).click();

    // ダイアログが開く
    await expect(page.getByText('Add New Client')).toBeVisible();

    // フォームに入力
    await page.getByLabel('Client Name').fill(CLIENT_NAME);
    await page.getByLabel('Department').fill(CLIENT_DEPARTMENT);
    await page.getByLabel('Email').fill(CLIENT_EMAIL);
    await page.getByLabel('Description').fill(CLIENT_DESCRIPTION);

    // "Create" ボタンをクリック
    await page.getByRole('button', { name: 'Create' }).click();

    // ダイアログが閉じてテーブルにクライアントが表示される
    await expect(page.getByText('Add New Client')).not.toBeVisible();
    await expect(page.getByText(CLIENT_NAME)).toBeVisible();
    await expect(page.getByText(CLIENT_DEPARTMENT)).toBeVisible();
  });

  // ============================================
  // Step 4: 作業エントリ作成
  // ============================================
  test('Step 4: Work Entriesページに遷移して作業エントリを作成する', async () => {
    // サイドバーの "Work Entries" をクリック
    await page.getByRole('link', { name: 'Work Entries' }).or(page.locator('text=Work Entries').first()).click();
    await page.waitForURL('**/work-entries');

    // 空状態メッセージを確認
    await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();

    // "Add Work Entry" ボタンをクリック
    await page.getByRole('button', { name: 'Add Work Entry' }).click();

    // ダイアログが開く
    await expect(page.getByText('Add New Work Entry')).toBeVisible();

    // クライアントを選択（MUI Select）
    // MUI Select は通常の select ではないので、クリックしてメニューアイテムを選ぶ
    // MUI Select renders as div[role="combobox"], use locator within the dialog
    const clientSelect = page.locator('[role="combobox"]').first();
    await clientSelect.click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // 時間を入力
    await page.getByLabel('Hours').fill(WORK_HOURS);

    // 説明を入力
    await page.getByLabel('Description').fill(WORK_DESCRIPTION);

    // Date は DatePicker で今日の日付がデフォルトなのでそのまま

    // "Create" ボタンをクリック
    await page.getByRole('button', { name: 'Create' }).click();

    // ダイアログが閉じてテーブルにエントリが表示される
    await expect(page.getByText('Add New Work Entry')).not.toBeVisible();
    await expect(page.getByText(CLIENT_NAME)).toBeVisible();
    await expect(page.getByText(`${WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByText(WORK_DESCRIPTION)).toBeVisible();
  });

  // ============================================
  // Step 5: ダッシュボードの統計が更新されていることを確認
  // ============================================
  test('Step 5: ダッシュボードの統計が更新されていることを確認する', async () => {
    // サイドバーの "Dashboard" をクリック
    await page.getByRole('link', { name: 'Dashboard' }).or(page.locator('text=Dashboard').first()).click();
    await page.waitForURL('**/dashboard');

    // 統計カードの値が更新されている
    // Total Clients: 1, Total Work Entries: 1, Total Hours: 3.50
    // CardContent > Box > Box > (Typography h6 title + Typography h4 value)
    // Use xpath-like traversal: find the card containing the title text, then check the h4 within it
    const clientsCard = page.locator('.MuiCard-root', { hasText: 'Total Clients' });
    await expect(clientsCard.locator('h4, .MuiTypography-h4')).toContainText('1');

    const entriesCard = page.locator('.MuiCard-root', { hasText: 'Total Work Entries' });
    await expect(entriesCard.locator('h4, .MuiTypography-h4')).toContainText('1');

    const hoursCard = page.locator('.MuiCard-root', { hasText: 'Total Hours' });
    await expect(hoursCard.locator('h4, .MuiTypography-h4')).toContainText('3.50');

    // Recent Work Entries にエントリが表示される
    await expect(page.getByText(CLIENT_NAME)).toBeVisible();
    await expect(page.getByText(WORK_DESCRIPTION)).toBeVisible();
  });

  // ============================================
  // Step 6: レポート確認
  // ============================================
  test('Step 6: Reportsページでクライアントレポートを確認する', async () => {
    // サイドバーの "Reports" をクリック
    await page.getByRole('link', { name: 'Reports' }).or(page.locator('text=Reports').first()).click();
    await page.waitForURL('**/reports');

    // "Select a client to view their time report." が表示される
    await expect(page.getByText('Select a client to view their time report.')).toBeVisible();

    // クライアントを選択（MUI Select - use role="combobox"）
    await page.locator('[role="combobox"]').click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();

    // レポートカードが表示される
    await expect(page.getByText('Total Hours')).toBeVisible();
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.getByText('Average Hours per Entry')).toBeVisible();

    // 値を確認
    // Total Hours: 3.50, Total Entries: 1, Average: 3.50
    const totalHoursCard = page.locator('.MuiCard-root', { hasText: 'Total Hours' });
    await expect(totalHoursCard.locator('h4, .MuiTypography-h4')).toContainText('3.50');
    const totalEntriesCard = page.locator('.MuiCard-root', { hasText: 'Total Entries' });
    await expect(totalEntriesCard.locator('h4, .MuiTypography-h4')).toContainText('1');

    // エントリテーブルにデータが表示される
    await expect(page.getByText(WORK_DESCRIPTION)).toBeVisible();
  });

  // ============================================
  // Step 7: CSV/PDFエクスポート
  // ============================================
  test('Step 7: CSV/PDFエクスポートが動作することを確認する', async () => {
    // CSV エクスポート - ReportsPage uses IconButton with Tooltip
    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export as CSV' }).or(page.locator('[aria-label="Export as CSV"]')).click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toContain('.csv');

    // PDF エクスポート
    const pdfDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export as PDF' }).or(page.locator('[aria-label="Export as PDF"]')).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toContain('.pdf');
  });

  // ============================================
  // Step 8: 作業エントリの編集
  // ============================================
  test('Step 8: 作業エントリを編集する', async () => {
    // Work Entries ページに遷移
    await page.getByRole('link', { name: 'Work Entries' }).or(page.locator('text=Work Entries').first()).click();
    await page.waitForURL('**/work-entries');

    // Edit ボタン（EditIcon の IconButton）をクリック
    // テーブル行内の edit ボタンを探す
    await page.getByRole('button', { name: /edit/i }).or(page.locator('[data-testid="EditIcon"]').first()).click();

    // ダイアログが開く
    await expect(page.getByText('Edit Work Entry')).toBeVisible();

    // 時間と説明を更新
    await page.getByLabel('Hours').clear();
    await page.getByLabel('Hours').fill(UPDATED_WORK_HOURS);
    await page.getByLabel('Description').clear();
    await page.getByLabel('Description').fill(UPDATED_WORK_DESCRIPTION);

    // "Update" ボタンをクリック
    await page.getByRole('button', { name: 'Update' }).click();

    // テーブルが更新される
    await expect(page.getByText('Edit Work Entry')).not.toBeVisible();
    await expect(page.getByText(`${UPDATED_WORK_HOURS} hours`)).toBeVisible();
    await expect(page.getByText(UPDATED_WORK_DESCRIPTION)).toBeVisible();
  });

  // ============================================
  // Step 9: 作業エントリの削除
  // ============================================
  test('Step 9: 作業エントリを削除する', async () => {
    // window.confirm を自動で accept するハンドラを設定 (once で一回限り)
    page.once('dialog', dialog => dialog.accept());

    // Delete ボタンをクリック
    await page.getByRole('button', { name: /delete/i }).or(page.locator('[data-testid="DeleteIcon"]').first()).click();

    // エントリが消えて空状態メッセージが表示される
    await expect(page.getByText('No work entries found. Add your first work entry to get started.')).toBeVisible();
  });

  // ============================================
  // Step 10: クライアントの削除
  // ============================================
  test('Step 10: クライアントを削除する', async () => {
    // Clients ページに遷移
    await page.getByRole('link', { name: 'Clients' }).or(page.locator('text=Clients').first()).click();
    await page.waitForURL('**/clients');

    // window.confirm を自動で accept するハンドラを設定 (once で一回限り)
    page.once('dialog', dialog => dialog.accept());

    // Delete ボタンをクリック
    await page.getByRole('button', { name: /delete/i }).or(page.locator('[data-testid="DeleteIcon"]').first()).click();

    // クライアントが消えて空状態メッセージが表示される
    await expect(page.getByText('No clients found. Create your first client to get started.')).toBeVisible();
  });

  // ============================================
  // Step 11: ログアウト
  // ============================================
  test('Step 11: ログアウトしてログインページに戻る', async () => {
    // Logout ボタンをクリック
    await page.getByRole('button', { name: 'Logout' }).click();

    // ログインページにリダイレクトされる
    await page.waitForURL('**/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  // ============================================
  // Step 12: 未認証でのリダイレクト確認
  // ============================================
  test('Step 12: 未認証で保護ページにアクセスするとログインにリダイレクトされる', async () => {
    await page.goto('/clients');
    await page.waitForURL('**/login');
    await expect(page.getByText('Time Tracker')).toBeVisible();
  });
});
