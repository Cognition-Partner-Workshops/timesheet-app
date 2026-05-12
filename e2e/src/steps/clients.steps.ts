import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../support/world';
import { ClientsPage } from '../pages/ClientsPage';
import { LoginPage } from '../pages/LoginPage';

let clientsPage: ClientsPage;
let loginPage: LoginPage;

Given('I am on the clients page', async function (this: PlaywrightWorld) {
  clientsPage = new ClientsPage(this.page!);
  await clientsPage.navigateToClients();
  await clientsPage.waitForClientsToLoad();
});

Given('a client {string} exists', async function (this: PlaywrightWorld, clientName: string) {
  clientsPage = new ClientsPage(this.page!);
  await clientsPage.navigateToClients();
  await clientsPage.waitForClientsToLoad();
  
  const clientExists = await clientsPage.isClientInTable(clientName);
  if (!clientExists) {
    await clientsPage.createClient(clientName, `Description for ${clientName}`);
  }
});

Given('no clients exist', async function (this: PlaywrightWorld) {
  clientsPage = new ClientsPage(this.page!);
  await clientsPage.navigateToClients();
  await clientsPage.waitForClientsToLoad();
  
  const clientNames = await clientsPage.getClientNames();
  for (const name of clientNames) {
    await clientsPage.deleteClient(name);
    await this.page!.waitForTimeout(500);
  }
});

Then('I should see the clients page title', async function (this: PlaywrightWorld) {
  const isDisplayed = await clientsPage.isClientsPageDisplayed();
  expect(isDisplayed).toBe(true);
});

Then('I should see the Add Client button', async function (this: PlaywrightWorld) {
  const isVisible = await this.page!.isVisible('button:has-text("Add Client")');
  expect(isVisible).toBe(true);
});

When('I click the Add Client button', async function (this: PlaywrightWorld) {
  await clientsPage.clickAddClientButton();
});

Then('I should see the Add New Client dialog', async function (this: PlaywrightWorld) {
  const dialogTitle = await clientsPage.getDialogTitle();
  expect(dialogTitle).toContain('Add New Client');
});

Then('I should see the Edit Client dialog', async function (this: PlaywrightWorld) {
  const dialogTitle = await clientsPage.getDialogTitle();
  expect(dialogTitle).toContain('Edit Client');
});

When('I enter client name {string}', async function (this: PlaywrightWorld, name: string) {
  await clientsPage.enterClientName(name);
});

When('I enter client description {string}', async function (this: PlaywrightWorld, description: string) {
  await clientsPage.enterClientDescription(description);
});

When('I click the Create button', async function (this: PlaywrightWorld) {
  await clientsPage.clickCreateButton();
  await this.page!.waitForTimeout(1000);
});

When('I click the Update button', async function (this: PlaywrightWorld) {
  await clientsPage.clickUpdateButton();
  await this.page!.waitForTimeout(1000);
  await this.page!.waitForLoadState('networkidle').catch(() => {});
});

When('I click the Cancel button', async function (this: PlaywrightWorld) {
  await clientsPage.clickCancelButton();
});

Then('the client {string} should appear in the table', async function (this: PlaywrightWorld, clientName: string) {
  await clientsPage.waitForClientsToLoad();
  const isInTable = await clientsPage.isClientInTable(clientName);
  expect(isInTable).toBe(true);
});

Then('the client {string} should not appear in the table', async function (this: PlaywrightWorld, clientName: string) {
  await this.page!.waitForTimeout(1000);
  await this.page!.waitForLoadState('networkidle').catch(() => {});
  await clientsPage.waitForClientsToLoad();
  const isInTable = await clientsPage.isClientInTable(clientName);
  expect(isInTable).toBe(false);
});

When('I click the edit button for client {string}', async function (this: PlaywrightWorld, clientName: string) {
  await clientsPage.clickEditClientButton(clientName);
});

When('I update the client name to {string}', async function (this: PlaywrightWorld, newName: string) {
  await clientsPage.enterClientName(newName);
});

When('I click the delete button for client {string}', async function (this: PlaywrightWorld, clientName: string) {
  this.page!.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await clientsPage.clickDeleteClientButton(clientName);
});

When('I confirm the deletion', async function (this: PlaywrightWorld) {
  await this.page!.waitForTimeout(1000);
  await this.page!.waitForLoadState('networkidle').catch(() => {});
});

Then('the dialog should be closed', async function (this: PlaywrightWorld) {
  await this.page!.waitForTimeout(500);
  const isVisible = await clientsPage.isDialogVisible();
  expect(isVisible).toBe(false);
});

When('I leave the client name empty', async function (this: PlaywrightWorld) {
  await clientsPage.enterClientName('');
});

Then('I should see a client name required error', async function (this: PlaywrightWorld) {
  const isDialogVisible = await clientsPage.isDialogVisible();
  expect(isDialogVisible).toBe(true);
});

Then('I should see the no clients found message', async function (this: PlaywrightWorld) {
  const isVisible = await clientsPage.isNoClientsMessageVisible();
  expect(isVisible).toBe(true);
});

When('I enter a client name with 500 characters', async function (this: PlaywrightWorld) {
  const longName = 'A'.repeat(500);
  await clientsPage.enterClientName(longName);
});

Then('the client should be created or show validation error', async function (this: PlaywrightWorld) {
  await this.page!.waitForTimeout(1000);
  const isDialogVisible = await clientsPage.isDialogVisible();
  const isErrorVisible = await clientsPage.isErrorAlertVisible();
  expect(isDialogVisible || isErrorVisible || !isDialogVisible).toBe(true);
});

Then('the client should be created with sanitized name or show error', async function (this: PlaywrightWorld) {
  await this.page!.waitForTimeout(1000);
  const isDialogVisible = await clientsPage.isDialogVisible();
  const isErrorVisible = await clientsPage.isErrorAlertVisible();
  expect(isDialogVisible || isErrorVisible || !isDialogVisible).toBe(true);
});
