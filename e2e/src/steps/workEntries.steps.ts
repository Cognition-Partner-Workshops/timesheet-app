import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../support/world';
import { WorkEntriesPage } from '../pages/WorkEntriesPage';
import { ClientsPage } from '../pages/ClientsPage';

let workEntriesPage: WorkEntriesPage;
let clientsPage: ClientsPage;

Given('I am on the work entries page', async function (this: PlaywrightWorld) {
  workEntriesPage = new WorkEntriesPage(this.page!);
  await workEntriesPage.navigateToWorkEntries();
  await workEntriesPage.waitForWorkEntriesToLoad();
});

Given('a work entry for {string} with {string} hours exists', async function (this: PlaywrightWorld, clientName: string, hours: string) {
  workEntriesPage = new WorkEntriesPage(this.page!);
  await workEntriesPage.navigateToWorkEntries();
  await workEntriesPage.waitForWorkEntriesToLoad();
  
  const entryExists = await workEntriesPage.isWorkEntryInTable(clientName, hours);
  if (!entryExists) {
    await workEntriesPage.createWorkEntry(clientName, hours, `Work entry for ${clientName}`);
  }
});

Given('no work entries exist', async function (this: PlaywrightWorld) {
  workEntriesPage = new WorkEntriesPage(this.page!);
  await workEntriesPage.navigateToWorkEntries();
  await workEntriesPage.waitForWorkEntriesToLoad();
});

Given('no work entries exist for {string}', async function (this: PlaywrightWorld, clientName: string) {
  workEntriesPage = new WorkEntriesPage(this.page!);
  await workEntriesPage.navigateToWorkEntries();
  await workEntriesPage.waitForWorkEntriesToLoad();
});

Then('I should see the work entries page title', async function (this: PlaywrightWorld) {
  const isDisplayed = await workEntriesPage.isWorkEntriesPageDisplayed();
  expect(isDisplayed).toBe(true);
});

Then('I should see the Add Work Entry button', async function (this: PlaywrightWorld) {
  const isVisible = await this.page!.isVisible('button:has-text("Add Work Entry")');
  expect(isVisible).toBe(true);
});

When('I click the Add Work Entry button', async function (this: PlaywrightWorld) {
  await workEntriesPage.clickAddWorkEntryButton();
});

Then('I should see the Add New Work Entry dialog', async function (this: PlaywrightWorld) {
  const dialogTitle = await workEntriesPage.getDialogTitle();
  expect(dialogTitle).toContain('Add New Work Entry');
});

Then('I should see the Edit Work Entry dialog', async function (this: PlaywrightWorld) {
  const dialogTitle = await workEntriesPage.getDialogTitle();
  expect(dialogTitle).toContain('Edit Work Entry');
});

When('I select client {string}', async function (this: PlaywrightWorld, clientName: string) {
  await workEntriesPage.selectClient(clientName);
});

When('I enter hours {string}', async function (this: PlaywrightWorld, hours: string) {
  await workEntriesPage.enterHours(hours);
});

When('I enter work description {string}', async function (this: PlaywrightWorld, description: string) {
  await workEntriesPage.enterDescription(description);
});

When('I update the hours to {string}', async function (this: PlaywrightWorld, hours: string) {
  await workEntriesPage.enterHours(hours);
});

Then('the work entry for {string} with {string} hours should appear in the table', async function (this: PlaywrightWorld, clientName: string, hours: string) {
  await workEntriesPage.waitForWorkEntriesToLoad();
  const isInTable = await workEntriesPage.isWorkEntryInTable(clientName, hours);
  expect(isInTable).toBe(true);
});

Then('the work entry for {string} should not appear in the table', async function (this: PlaywrightWorld, clientName: string) {
  await workEntriesPage.waitForWorkEntriesToLoad();
  await this.page!.waitForTimeout(1000);
  const isInTable = await this.page!.isVisible(`tbody tr:has-text("${clientName}")`);
  expect(isInTable).toBe(false);
});

When('I click the edit button for work entry {string}', async function (this: PlaywrightWorld, clientName: string) {
  await workEntriesPage.clickEditWorkEntryButton(clientName);
});

When('I click the delete button for work entry {string}', async function (this: PlaywrightWorld, clientName: string) {
  this.page!.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await workEntriesPage.clickDeleteWorkEntryButton(clientName);
});

Then('I should see a client selection required error', async function (this: PlaywrightWorld) {
  const isDialogVisible = await workEntriesPage.isDialogVisible();
  expect(isDialogVisible).toBe(true);
});

Then('I should see an hours validation error', async function (this: PlaywrightWorld) {
  const isDialogVisible = await workEntriesPage.isDialogVisible();
  expect(isDialogVisible).toBe(true);
});

Then('I should see the create client first message', async function (this: PlaywrightWorld) {
  const isVisible = await workEntriesPage.isNoClientsMessageVisible();
  expect(isVisible).toBe(true);
});

Then('I should see the no work entries found message', async function (this: PlaywrightWorld) {
  const isVisible = await workEntriesPage.isNoEntriesMessageVisible();
  expect(isVisible).toBe(true);
});
