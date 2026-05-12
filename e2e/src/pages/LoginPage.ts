import { Page } from 'playwright';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private selectors = {
    emailInput: '#email',
    loginButton: 'button[type="submit"]',
    pageTitle: 'h1',
    infoAlert: '.MuiAlert-standardInfo',
    errorAlert: '.MuiAlert-standardError',
    loadingSpinner: '.MuiCircularProgress-root',
    emailLabel: 'label[for="email"]'
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToLogin(): Promise<void> {
    await this.navigate('/login');
    await this.waitForLoadingToDisappear();
  }

  async enterEmail(email: string): Promise<void> {
    await this.clearAndFill(this.selectors.emailInput, email);
  }

  async clickLoginButton(): Promise<void> {
    await this.click(this.selectors.loginButton);
  }

  async login(email: string): Promise<void> {
    await this.enterEmail(email);
    await this.clickLoginButton();
    await this.waitForNavigation();
    // Wait for auth state to settle and Layout to render
    await this.page.waitForSelector('.MuiAppBar-root', { state: 'visible', timeout: 15000 });
  }

  async getPageTitle(): Promise<string> {
    return await this.getText(this.selectors.pageTitle);
  }

  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.isEnabled(this.selectors.loginButton);
  }

  async isLoginButtonDisabled(): Promise<boolean> {
    const isEnabled = await this.isEnabled(this.selectors.loginButton);
    return !isEnabled;
  }

  async getInfoAlertText(): Promise<string> {
    return await this.getText(this.selectors.infoAlert);
  }

  async getErrorAlertText(): Promise<string> {
    if (await this.isVisible(this.selectors.errorAlert)) {
      return await this.getText(this.selectors.errorAlert);
    }
    return '';
  }

  async isErrorAlertVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorAlert);
  }

  async isLoadingSpinnerVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.loadingSpinner);
  }

  async isEmailInputVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.emailInput);
  }

  async isLoginPageDisplayed(): Promise<boolean> {
    const title = await this.getPageTitle();
    return title.includes('Time Tracker');
  }

  async getEmailInputValue(): Promise<string> {
    return await this.getInputValue(this.selectors.emailInput);
  }

  async clearEmailInput(): Promise<void> {
    await this.clearAndFill(this.selectors.emailInput, '');
  }

  async isOnLoginPage(): Promise<boolean> {
    const url = await this.getUrl();
    return url.includes('/login');
  }
}
