import { Page } from 'playwright';
import { BasePage } from './BasePage';

export class ReportsPage extends BasePage {
  private selectors = {
    pageTitle: 'h4',
    clientSelect: '.MuiSelect-select',
    csvExportButton: 'button:has([data-testid="DescriptionIcon"])',
    pdfExportButton: 'button:has([data-testid="PictureAsPdfIcon"])',
    totalHoursCard: 'text=Total Hours',
    totalEntriesCard: 'text=Total Entries',
    averageHoursCard: 'text=Average Hours per Entry',
    reportTable: 'table',
    tableRows: 'tbody tr',
    noEntriesMessage: 'text=No work entries found for this client',
    noClientsMessage: 'text=You need to create at least one client',
    selectClientMessage: 'text=Select a client to view their time report',
    createClientButton: 'a[href="/clients"], button:has-text("Create Client")',
    loadingSpinner: '.MuiCircularProgress-root',
    menuItem: '.MuiMenuItem-root',
    errorAlert: '.MuiAlert-standardError',
    statsCard: '.MuiCard-root'
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToReports(): Promise<void> {
    try {
      await this.navigateViaSidebar('Reports');
    } catch {
      await this.navigate('/reports');
    }
    await this.waitForLoadingToDisappear();
  }

  async getPageTitle(): Promise<string> {
    return await this.getText(this.selectors.pageTitle);
  }

  async isReportsPageDisplayed(): Promise<boolean> {
    const title = await this.getPageTitle();
    return title.includes('Reports');
  }

  async selectClient(clientName: string): Promise<void> {
    await this.click(this.selectors.clientSelect);
    await this.page.waitForSelector(this.selectors.menuItem, { timeout: 5000 });
    await this.page.click(`.MuiMenuItem-root:has-text("${clientName}")`);
    await this.page.waitForSelector(this.selectors.menuItem, { state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.waitForLoadingToDisappear();
  }

  async clickCsvExportButton(): Promise<void> {
    await this.click(this.selectors.csvExportButton);
  }

  async clickPdfExportButton(): Promise<void> {
    await this.click(this.selectors.pdfExportButton);
  }

  async isTotalHoursCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.totalHoursCard);
  }

  async isTotalEntriesCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.totalEntriesCard);
  }

  async isAverageHoursCardVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.averageHoursCard);
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

  async getTotalEntriesValue(): Promise<string> {
    await this.waitForElement(this.selectors.totalEntriesCard);
    const card = await this.page.$(`${this.selectors.statsCard}:has-text("Total Entries")`);
    if (card) {
      const valueElement = await card.$('.MuiTypography-h4');
      return valueElement ? (await valueElement.textContent()) || '0' : '0';
    }
    return '0';
  }

  async getAverageHoursValue(): Promise<string> {
    await this.waitForElement(this.selectors.averageHoursCard);
    const card = await this.page.$(`${this.selectors.statsCard}:has-text("Average Hours per Entry")`);
    if (card) {
      const valueElement = await card.$('.MuiTypography-h4');
      return valueElement ? (await valueElement.textContent()) || '0.00' : '0.00';
    }
    return '0.00';
  }

  async getReportEntryCount(): Promise<number> {
    await this.waitForLoadingToDisappear();
    const noEntries = await this.isVisible(this.selectors.noEntriesMessage);
    if (noEntries) {
      return 0;
    }
    const rows = await this.page.$$(this.selectors.tableRows);
    return rows.length;
  }

  async isReportTableVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.reportTable);
  }

  async isNoEntriesMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noEntriesMessage);
  }

  async isNoClientsMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noClientsMessage);
  }

  async isSelectClientMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.selectClientMessage);
  }

  async isOnReportsPage(): Promise<boolean> {
    const url = await this.getUrl();
    return url.includes('/reports');
  }

  async waitForReportsToLoad(): Promise<void> {
    await this.waitForLoadingToDisappear();
    await this.waitForElement(this.selectors.pageTitle, 30000);
  }

  async isCsvExportButtonEnabled(): Promise<boolean> {
    return await this.isEnabled(this.selectors.csvExportButton);
  }

  async isPdfExportButtonEnabled(): Promise<boolean> {
    return await this.isEnabled(this.selectors.pdfExportButton);
  }

  async isErrorAlertVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorAlert);
  }

  async getErrorAlertText(): Promise<string> {
    if (await this.isErrorAlertVisible()) {
      return await this.getText(this.selectors.errorAlert);
    }
    return '';
  }

  async clickCreateClientLink(): Promise<void> {
    await this.click(this.selectors.createClientButton);
    await this.waitForNavigation();
  }
}
