import { Page } from 'playwright';
import { config } from '../support/config';

export abstract class BasePage {
  protected page: Page;
  protected baseUrl: string;

  constructor(page: Page) {
    this.page = page;
    this.baseUrl = config.baseUrl;
  }

  async navigate(path: string = ''): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`, {
      waitUntil: 'networkidle',
      timeout: config.timeout.navigation
    });
  }

  async navigateViaSidebar(linkText: string): Promise<void> {
    const selector = `.MuiDrawer-docked .MuiListItemButton-root:has-text("${linkText}")`;
    await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    await this.page.click(selector);
    await this.page.waitForTimeout(500);
  }

  async waitForElement(selector: string, timeout: number = config.timeout.element): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  async click(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.click(selector);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.fill(selector, value);
  }

  async getText(selector: string): Promise<string> {
    await this.waitForElement(selector);
    const element = await this.page.$(selector);
    return element ? (await element.textContent()) || '' : '';
  }

  async isVisible(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      return await this.page.isVisible(selector);
    } catch {
      return false;
    }
  }

  async isEnabled(selector: string): Promise<boolean> {
    await this.waitForElement(selector);
    return await this.page.isEnabled(selector);
  }

  async getUrl(): Promise<string> {
    return this.page.url();
  }

  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `src/reports/screenshots/${name}.png`, fullPage: true });
  }

  async clearAndFill(selector: string, value: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.fill(selector, '');
    await this.page.fill(selector, value);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.selectOption(selector, value);
  }

  async getInputValue(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.inputValue(selector);
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async waitForText(text: string, timeout: number = config.timeout.element): Promise<void> {
    await this.page.waitForSelector(`text=${text}`, { timeout });
  }

  async getElementCount(selector: string): Promise<number> {
    const elements = await this.page.$$(selector);
    return elements.length;
  }

  async waitForLoadingToDisappear(): Promise<void> {
    try {
      await this.page.waitForSelector('[role="progressbar"]', { state: 'hidden', timeout: 10000 });
    } catch {
      // Loading indicator might not be present
    }
  }
}
