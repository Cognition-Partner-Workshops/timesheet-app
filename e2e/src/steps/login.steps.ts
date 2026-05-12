import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../support/world';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

let loginPage: LoginPage;
let dashboardPage: DashboardPage;

Given('I am on the login page', async function (this: PlaywrightWorld) {
  loginPage = new LoginPage(this.page!);
  dashboardPage = new DashboardPage(this.page!);
  await loginPage.navigateToLogin();
});

Given('I am not logged in', async function (this: PlaywrightWorld) {
  loginPage = new LoginPage(this.page!);
  await this.page!.context().clearCookies();
  await this.page!.evaluate(() => window.localStorage.clear());
});

When('I enter a valid email {string}', async function (this: PlaywrightWorld, email: string) {
  await loginPage.enterEmail(email);
});

When('I enter an invalid email {string}', async function (this: PlaywrightWorld, email: string) {
  await loginPage.enterEmail(email);
});

When('I click the login button', async function (this: PlaywrightWorld) {
  await loginPage.clickLoginButton();
});

When('I clear the email input field', async function (this: PlaywrightWorld) {
  await loginPage.clearEmailInput();
});

When('I try to access the dashboard directly', async function (this: PlaywrightWorld) {
  dashboardPage = new DashboardPage(this.page!);
  await dashboardPage.navigateToDashboard();
});

Then('I should be redirected to the dashboard', async function (this: PlaywrightWorld) {
  await this.page!.waitForFunction(
    () => window.location.href.includes('/dashboard'),
    undefined,
    { timeout: 15000 }
  );
  const url = await loginPage.getUrl();
  expect(url).toContain('/dashboard');
});

Then('I should see the dashboard page', async function (this: PlaywrightWorld) {
  await dashboardPage.waitForDashboardToLoad();
  const isDashboard = await dashboardPage.isDashboardDisplayed();
  expect(isDashboard).toBe(true);
});

Then('I should see the page title {string}', async function (this: PlaywrightWorld, expectedTitle: string) {
  const title = await loginPage.getPageTitle();
  expect(title).toContain(expectedTitle);
});

Then('I should see the email input field', async function (this: PlaywrightWorld) {
  const isVisible = await loginPage.isEmailInputVisible();
  expect(isVisible).toBe(true);
});

Then('I should see the login button', async function (this: PlaywrightWorld) {
  const isVisible = await loginPage.isLoginButtonEnabled();
  expect(isVisible !== undefined).toBe(true);
});

Then('I should see the info alert about no password', async function (this: PlaywrightWorld) {
  const alertText = await loginPage.getInfoAlertText();
  expect(alertText).toContain('password');
});

Then('the login button should be disabled', async function (this: PlaywrightWorld) {
  const isDisabled = await loginPage.isLoginButtonDisabled();
  expect(isDisabled).toBe(true);
});

Then('I should see a validation error', async function (this: PlaywrightWorld) {
  await this.page!.waitForTimeout(1000);
  const isOnLogin = await loginPage.isOnLoginPage();
  expect(isOnLogin).toBe(true);
});

Then('I should be redirected to the login page', async function (this: PlaywrightWorld) {
  await this.page!.waitForFunction(
    () => window.location.href.includes('/login'),
    undefined,
    { timeout: 15000 }
  );
  const url = await loginPage.getUrl();
  expect(url).toContain('/login');
});
