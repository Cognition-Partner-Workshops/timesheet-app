const { test, expect } = require('@playwright/test');

// Helper to login
async function login(page, email = 'e2e-test@example.com') {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.click('button[type="submit"]');
  // Wait for dashboard content to appear instead of URL pattern
  await expect(page.locator('text=Total Clients')).toBeVisible({ timeout: 10000 });
}

// Helper to clean up test data via API
async function cleanupTestData(request) {
  try {
    await request.delete('http://localhost:3001/api/clients', {
      headers: { 'x-user-email': 'e2e-test@example.com' }
    });
  } catch (e) {
    // Ignore cleanup errors
  }
}

test.describe('Login Flow', () => {
  test('should display login page with email field', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('h1')).toContainText('Time Tracker');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with email', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'e2e-test@example.com');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Total Clients')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  });

  test('should show login button disabled when email is empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to all pages via sidebar', async ({ page }) => {
    await expect(page.locator('text=Total Clients')).toBeVisible();

    // Clients
    await page.click('text=Clients');
    await expect(page.locator('h4:has-text("Clients")')).toBeVisible({ timeout: 5000 });

    // Work Entries
    await page.click('text=Work Entries');
    await expect(page.locator('h4:has-text("Work Entries")')).toBeVisible({ timeout: 5000 });

    // Reports
    await page.click('text=Reports');
    await expect(page.locator('h4:has-text("Reports")')).toBeVisible({ timeout: 5000 });
  });

  test('should display user email in app bar', async ({ page }) => {
    await expect(page.locator('text=e2e-test@example.com')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.click('text=LOGOUT');
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Client Management', () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupTestData(request);
    await login(page);
    await page.click('text=Clients');
    await expect(page.locator('h4:has-text("Clients")')).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request);
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await expect(page.locator('text=No clients found')).toBeVisible({ timeout: 5000 });
  });

  test('should create a new client', async ({ page }) => {
    await page.click('button:has-text("Add Client")');
    
    const dialog = page.locator('.MuiDialog-paper');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    const inputs = dialog.locator('input');
    await inputs.nth(0).fill('E2E Test Client');
    await inputs.nth(1).fill('Engineering');
    await inputs.nth(2).fill('client@e2e-test.com');
    await dialog.locator('textarea').first().fill('Test client for E2E testing');
    
    await dialog.locator('button:has-text("Create")').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=E2E Test Client')).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing client', async ({ page, request }) => {
    // Create a client via API first
    await request.post('http://localhost:3001/api/clients', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { name: 'Client to Edit', description: 'Original description' }
    });
    
    await page.reload();
    await expect(page.locator('text=Client to Edit')).toBeVisible({ timeout: 5000 });
    
    // Click edit button
    const row = page.locator('tr:has-text("Client to Edit")');
    await row.locator('[data-testid="EditIcon"]').click();
    
    // Wait for dialog
    const dialog = page.locator('.MuiDialog-paper');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Edit Client')).toBeVisible();
    
    // Update name
    const nameInput = dialog.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('Updated Client Name');
    
    await dialog.locator('button:has-text("Update")').click();
    
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Updated Client Name')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a client', async ({ page, request }) => {
    // Create a client via API first
    await request.post('http://localhost:3001/api/clients', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { name: 'Client to Delete' }
    });
    
    await page.reload();
    await expect(page.locator('text=Client to Delete')).toBeVisible({ timeout: 5000 });
    
    // Set up dialog handler for confirm
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete button
    const row = page.locator('tr:has-text("Client to Delete")');
    await row.locator('[data-testid="DeleteIcon"]').click();
    
    // Verify client is removed
    await expect(page.locator('text=Client to Delete')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Work Entry Management', () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupTestData(request);
    
    // Create a test client via API
    await request.post('http://localhost:3001/api/clients', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { name: 'E2E Test Client' }
    });
    
    await login(page);
    await page.click('text=Work Entries');
    await expect(page.locator('h4:has-text("Work Entries")')).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request);
  });

  test('should show empty state with no work entries', async ({ page }) => {
    await expect(page.locator('text=No work entries found')).toBeVisible({ timeout: 5000 });
  });

  test('should create a work entry', async ({ page }) => {
    await page.click('button:has-text("Add Work Entry")');
    
    const dialog = page.locator('.MuiDialog-paper');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Select client from dropdown
    await dialog.locator('.MuiSelect-select').click();
    await page.locator('li[role="option"]:has-text("E2E Test Client")').click();
    
    // Fill hours
    await dialog.locator('input[type="number"]').fill('4.5');
    
    // Fill description
    await dialog.locator('textarea').first().fill('E2E test work entry');
    
    await dialog.locator('button:has-text("Create")').click();
    
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=E2E Test Client')).toBeVisible({ timeout: 5000 });
  });

  test('should edit a work entry', async ({ page, request }) => {
    // Create work entry via API
    const clientsRes = await request.get('http://localhost:3001/api/clients', {
      headers: { 'x-user-email': 'e2e-test@example.com' }
    });
    const clientsData = await clientsRes.json();
    const clientId = clientsData.clients[0].id;
    
    await request.post('http://localhost:3001/api/work-entries', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { 
        clientId, 
        hours: 3, 
        description: 'Original entry',
        date: new Date().toISOString().split('T')[0]
      }
    });
    
    await page.reload();
    await expect(page.locator('text=Original entry')).toBeVisible({ timeout: 5000 });
    
    // Click edit button
    const row = page.locator('tr:has-text("Original entry")');
    await row.locator('[data-testid="EditIcon"]').click();
    
    const dialog = page.locator('.MuiDialog-paper');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Update hours
    const hoursInput = dialog.locator('input[type="number"]');
    await hoursInput.clear();
    await hoursInput.fill('5');
    
    await dialog.locator('button:has-text("Update")').click();
    
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('should delete a work entry', async ({ page, request }) => {
    // Create work entry via API
    const clientsRes = await request.get('http://localhost:3001/api/clients', {
      headers: { 'x-user-email': 'e2e-test@example.com' }
    });
    const clientsData = await clientsRes.json();
    const clientId = clientsData.clients[0].id;
    
    await request.post('http://localhost:3001/api/work-entries', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { 
        clientId, 
        hours: 2, 
        description: 'Entry to delete',
        date: new Date().toISOString().split('T')[0]
      }
    });
    
    await page.reload();
    await expect(page.locator('text=Entry to delete')).toBeVisible({ timeout: 5000 });
    
    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete
    const row = page.locator('tr:has-text("Entry to delete")');
    await row.locator('[data-testid="DeleteIcon"]').click();
    
    await expect(page.locator('text=Entry to delete')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupTestData(request);
    
    // Create client and work entry via API
    const clientRes = await request.post('http://localhost:3001/api/clients', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { name: 'Report Test Client' }
    });
    const clientData = await clientRes.json();
    const clientId = clientData.client.id;
    
    await request.post('http://localhost:3001/api/work-entries', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { 
        clientId, 
        hours: 8, 
        description: 'Full day work',
        date: new Date().toISOString().split('T')[0]
      }
    });
    
    await request.post('http://localhost:3001/api/work-entries', {
      headers: { 
        'x-user-email': 'e2e-test@example.com',
        'Content-Type': 'application/json'
      },
      data: { 
        clientId, 
        hours: 4.5, 
        description: 'Half day work',
        date: new Date().toISOString().split('T')[0]
      }
    });
    
    await login(page);
    await page.click('text=Reports');
    await expect(page.locator('h4:has-text("Reports")')).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request);
  });

  test('should show client selector', async ({ page }) => {
    await expect(page.locator('label:has-text("Select Client")')).toBeVisible({ timeout: 5000 });
  });

  test('should display report when client is selected', async ({ page }) => {
    await page.locator('.MuiSelect-select').first().click();
    await page.locator('li[role="option"]:has-text("Report Test Client")').click();
    
    await expect(page.locator('text=Total Hours')).toBeVisible({ timeout: 10000 });
  });

  test('should show work entry details in report table', async ({ page }) => {
    await page.locator('.MuiSelect-select').first().click();
    await page.locator('li[role="option"]:has-text("Report Test Client")').click();
    
    await expect(page.locator('text=Full day work')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Half day work')).toBeVisible();
  });
});

test.describe('Full User Workflow', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupTestData(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request);
  });

  test('should complete full workflow: login -> create client -> add work entry -> check reports', async ({ page }) => {
    // Step 1: Login
    await login(page);
    await expect(page.locator('text=Total Clients')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Navigate to Clients and create one
    await page.click('text=Clients');
    await expect(page.locator('h4:has-text("Clients")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Add Client")');
    
    const clientDialog = page.locator('.MuiDialog-paper');
    await expect(clientDialog).toBeVisible({ timeout: 5000 });
    const clientInputs = clientDialog.locator('input');
    await clientInputs.nth(0).fill('Workflow Test Corp');
    await clientInputs.nth(1).fill('Testing');
    await clientDialog.locator('button:has-text("Create")').click();
    await expect(clientDialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Workflow Test Corp')).toBeVisible({ timeout: 5000 });
    
    // Step 3: Navigate to Work Entries and create one
    await page.click('text=Work Entries');
    await expect(page.locator('h4:has-text("Work Entries")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Add Work Entry")');
    
    const entryDialog = page.locator('.MuiDialog-paper');
    await expect(entryDialog).toBeVisible({ timeout: 5000 });
    
    // Select client
    await entryDialog.locator('.MuiSelect-select').click();
    await page.locator('li[role="option"]:has-text("Workflow Test Corp")').click();
    
    // Fill hours
    await entryDialog.locator('input[type="number"]').fill('6');
    
    // Fill description  
    await entryDialog.locator('textarea').first().fill('Full workflow test');
    
    await entryDialog.locator('button:has-text("Create")').click();
    await expect(entryDialog).not.toBeVisible({ timeout: 5000 });
    
    // Step 4: Navigate to Reports and verify
    await page.click('text=Reports');
    await expect(page.locator('h4:has-text("Reports")')).toBeVisible({ timeout: 5000 });
    
    await page.locator('.MuiSelect-select').first().click();
    await page.locator('li[role="option"]:has-text("Workflow Test Corp")').click();
    
    await expect(page.locator('text=Total Hours')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Full workflow test')).toBeVisible();
  });
});
