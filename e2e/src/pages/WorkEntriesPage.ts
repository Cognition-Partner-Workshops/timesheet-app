import { Page } from 'playwright';
import { BasePage } from './BasePage';

export class WorkEntriesPage extends BasePage {
  private selectors = {
    pageTitle: 'h4',
    addWorkEntryButton: 'button:has-text("Add Work Entry")',
    workEntriesTable: 'table',
    tableRows: 'tbody tr',
    editButton: '[data-testid="EditIcon"]',
    deleteButton: '[data-testid="DeleteIcon"]',
    dialogTitle: '.MuiDialogTitle-root',
    clientSelect: '.MuiSelect-select',
    hoursInput: 'input[type="number"]',
    descriptionInput: 'textarea',
    dateInput: 'input[placeholder*="MM/DD/YYYY"], input[type="text"]:has(+ button)',
    cancelButton: 'button:has-text("Cancel")',
    createButton: 'button:has-text("Create")',
    updateButton: 'button:has-text("Update")',
    errorAlert: '.MuiAlert-standardError',
    noEntriesMessage: 'text=No work entries found',
    noClientsMessage: 'text=You need to create at least one client',
    createClientButton: 'a[href="/clients"], button:has-text("Create Client")',
    loadingSpinner: '.MuiCircularProgress-root',
    dialog: '.MuiDialog-root',
    menuItem: '.MuiMenuItem-root',
    hoursChip: '.MuiChip-root'
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToWorkEntries(): Promise<void> {
    try {
      await this.navigateViaSidebar('Work Entries');
    } catch {
      await this.navigate('/work-entries');
    }
    await this.waitForLoadingToDisappear();
  }

  async getPageTitle(): Promise<string> {
    return await this.getText(this.selectors.pageTitle);
  }

  async isWorkEntriesPageDisplayed(): Promise<boolean> {
    const title = await this.getPageTitle();
    return title.includes('Work Entries');
  }

  async clickAddWorkEntryButton(): Promise<void> {
    await this.click(this.selectors.addWorkEntryButton);
    await this.page.waitForSelector(this.selectors.dialog, { timeout: 5000 });
  }

  async selectClient(clientName: string): Promise<void> {
    await this.click(this.selectors.clientSelect);
    await this.page.waitForSelector(this.selectors.menuItem, { timeout: 5000 });
    await this.page.click(`.MuiMenuItem-root:has-text("${clientName}")`);
    await this.page.waitForSelector(this.selectors.menuItem, { state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async enterHours(hours: string): Promise<void> {
    const hoursInput = await this.page.$('.MuiDialog-root input[type="number"]');
    if (hoursInput) {
      await hoursInput.fill(hours);
    }
  }

  async enterDescription(description: string): Promise<void> {
    await this.fill(`${this.selectors.dialog} ${this.selectors.descriptionInput}`, description);
  }

  async enterDate(date: string): Promise<void> {
    const dateInput = await this.page.$('.MuiDialog-root input[placeholder]');
    if (dateInput) {
      await dateInput.fill(date);
    }
  }

  async clickCreateButton(): Promise<void> {
    await this.click(this.selectors.createButton);
  }

  async clickUpdateButton(): Promise<void> {
    await this.click(this.selectors.updateButton);
  }

  async clickCancelButton(): Promise<void> {
    await this.click(this.selectors.cancelButton);
  }

  async createWorkEntry(clientName: string, hours: string, description: string = ''): Promise<void> {
    await this.clickAddWorkEntryButton();
    await this.selectClient(clientName);
    await this.enterHours(hours);
    if (description) {
      await this.enterDescription(description);
    }
    await this.clickCreateButton();
    await this.waitForLoadingToDisappear();
    await this.page.waitForSelector(this.selectors.dialog, { state: 'hidden', timeout: 10000 });
  }

  async getWorkEntryCount(): Promise<number> {
    await this.waitForLoadingToDisappear();
    const noEntries = await this.isVisible(this.selectors.noEntriesMessage);
    if (noEntries) {
      return 0;
    }
    const rows = await this.page.$$(this.selectors.tableRows);
    return rows.length;
  }

  async isWorkEntryInTable(clientName: string, hours: string): Promise<boolean> {
    await this.waitForLoadingToDisappear();
    const entrySelector = `tr:has-text("${clientName}"):has-text("${hours} hours")`;
    return await this.isVisible(entrySelector);
  }

  async clickEditWorkEntryButton(clientName: string): Promise<void> {
    const row = await this.page.$(`tr:has-text("${clientName}")`);
    if (row) {
      const editBtn = await row.$('button:has([data-testid="EditIcon"])');
      if (editBtn) {
        await editBtn.click();
        await this.page.waitForSelector(this.selectors.dialog, { timeout: 5000 });
      }
    }
  }

  async clickDeleteWorkEntryButton(clientName: string): Promise<void> {
    const row = await this.page.$(`tr:has-text("${clientName}")`);
    if (row) {
      const deleteBtn = await row.$('button:has([data-testid="DeleteIcon"])');
      if (deleteBtn) {
        await deleteBtn.click();
      }
    }
  }

  async updateWorkEntry(clientName: string, newHours: string, newDescription: string = ''): Promise<void> {
    await this.clickEditWorkEntryButton(clientName);
    await this.enterHours(newHours);
    if (newDescription) {
      await this.enterDescription(newDescription);
    }
    await this.clickUpdateButton();
    await this.waitForLoadingToDisappear();
    await this.page.waitForSelector(this.selectors.dialog, { state: 'hidden', timeout: 10000 });
  }

  async deleteWorkEntry(clientName: string): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await this.clickDeleteWorkEntryButton(clientName);
    await this.waitForLoadingToDisappear();
    await this.page.waitForTimeout(500);
  }

  async isDialogVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.dialog);
  }

  async getDialogTitle(): Promise<string> {
    return await this.getText(this.selectors.dialogTitle);
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

  async isNoEntriesMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noEntriesMessage);
  }

  async isNoClientsMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noClientsMessage);
  }

  async isOnWorkEntriesPage(): Promise<boolean> {
    const url = await this.getUrl();
    return url.includes('/work-entries');
  }

  async waitForWorkEntriesToLoad(): Promise<void> {
    await this.waitForLoadingToDisappear();
    await this.waitForElement(this.selectors.pageTitle, 30000);
  }

  async clickCreateClientLink(): Promise<void> {
    await this.click(this.selectors.createClientButton);
    await this.waitForNavigation();
  }
}
