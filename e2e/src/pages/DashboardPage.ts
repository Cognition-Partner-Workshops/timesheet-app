import { Page } from 'playwright';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  private selectors = {
    pageTitle: 'h4',
    totalClientsCard: 'text=Total Clients',
    totalWorkEntriesCard: 'text=Total Work Entries',
    totalHoursCard: 'text=Total Hours',
    recentWorkEntries: 'text=Recent Work Entries',
    quickActions: 'text=Quick Actions',
    addClientButton: 'button:has-text("Add Client")',
    addWorkEntryButton: 'button:has-text("Add Work Entry")',
    addEntryButton: 'button:has-text("Add Entry")',
    viewReportsButton: 'button:has-text("View Reports")',
    statsCard: '.MuiCard-root',
    noEntriesMessage: 'text=No work entries yet',
    loadingSpinner: '.MuiCircularProgress-root'
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToDashboard(): Promise<void> {
    try {
      await this.navigateViaSidebar('Dashboard');
    } catch {
      await this.navigate('/dashboard');
    }
    await this.waitForLoadingToDisappear();
  }

  async getPageTitle(): Promise<string> {
    return await this.getText(this.selectors.pageTitle);
  }

  async isDashboardDisplayed(): Promise<boolean> {
    const title = await this.getPageTitle();
    return title.includes('Dashboard');
  }

  async isTotalClientsCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.totalClientsCard);
  }

  async isTotalWorkEntriesCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.totalWorkEntriesCard);
  }

  async isTotalHoursCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.totalHoursCard);
  }

  async isRecentWorkEntriesVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.recentWorkEntries);
  }

  async isQuickActionsVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.quickActions);
  }

  async clickAddClientButton(): Promise<void> {
    await this.click(this.selectors.addClientButton);
    await this.waitForNavigation();
  }

  async clickAddWorkEntryButton(): Promise<void> {
    await this.click(this.selectors.addWorkEntryButton);
    await this.waitForNavigation();
  }

  async clickAddEntryButton(): Promise<void> {
    await this.click(this.selectors.addEntryButton);
    await this.waitForNavigation();
  }

  async clickViewReportsButton(): Promise<void> {
    await this.click(this.selectors.viewReportsButton);
    await this.waitForNavigation();
  }

  async getStatsCardCount(): Promise<number> {
    return await this.getElementCount(this.selectors.statsCard);
  }

  async isNoEntriesMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noEntriesMessage);
  }

  async isOnDashboardPage(): Promise<boolean> {
    const url = await this.getUrl();
    return url.includes('/dashboard');
  }

  async getTotalClientsValue(): Promise<string> {
    await this.waitForElement(this.selectors.totalClientsCard);
    const card = await this.page.$(`${this.selectors.statsCard}:has-text("Total Clients")`);
    if (card) {
      const valueElement = await card.$('.MuiTypography-h4');
      return valueElement ? (await valueElement.textContent()) || '0' : '0';
    }
    return '0';
  }

  async getTotalWorkEntriesValue(): Promise<string> {
    await this.waitForElement(this.selectors.totalWorkEntriesCard);
    const card = await this.page.$(`${this.selectors.statsCard}:has-text("Total Work Entries")`);
    if (card) {
      const valueElement = await card.$('.MuiTypography-h4');
      return valueElement ? (await valueElement.textContent()) || '0' : '0';
    }
    return '0';
  }

  async getTotalHoursValue(): Promise<string> {
    await this.waitForElement(this.selectors.totalHoursCard);
    const card = await this.page.$(`${this.selectors.statsCard}:has-text("Total Hours")`);
    if (card) {
      const valueElement = await card.$('.MuiTypography-h4');
      return valueElement ? (await valueElement.textContent()) || '0.00' : '0.00';
    }
    return '0.00';
  }

  async waitForDashboardToLoad(): Promise<void> {
    await this.waitForLoadingToDisappear();
    await this.waitForElement(this.selectors.pageTitle, 30000);
  }
}
