import { Page } from 'playwright';
import { BasePage } from './BasePage';

export class ClientsPage extends BasePage {
  private selectors = {
    pageTitle: 'h4',
    addClientButton: 'button:has-text("Add Client")',
    clientsTable: 'table',
    tableRows: 'tbody tr',
    clientNameCell: 'td:first-child',
    editButton: '[data-testid="EditIcon"]',
    deleteButton: '[data-testid="DeleteIcon"]',
    dialogTitle: '.MuiDialogTitle-root',
    clientNameInput: 'input[label="Client Name"], .MuiDialog-root input:first-of-type',
    descriptionInput: 'textarea',
    cancelButton: 'button:has-text("Cancel")',
    createButton: 'button:has-text("Create")',
    updateButton: 'button:has-text("Update")',
    errorAlert: '.MuiAlert-standardError',
    noClientsMessage: 'text=No clients found',
    loadingSpinner: '.MuiCircularProgress-root',
    dialog: '.MuiDialog-root',
    tableContainer: '.MuiTableContainer-root'
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToClients(): Promise<void> {
    try {
      await this.navigateViaSidebar('Clients');
    } catch {
      await this.navigate('/clients');
    }
    await this.waitForLoadingToDisappear();
  }

  async getPageTitle(): Promise<string> {
    return await this.getText(this.selectors.pageTitle);
  }

  async isClientsPageDisplayed(): Promise<boolean> {
    const title = await this.getPageTitle();
    return title.includes('Clients');
  }

  async clickAddClientButton(): Promise<void> {
    await this.click(this.selectors.addClientButton);
    await this.page.waitForSelector(this.selectors.dialog, { timeout: 5000 });
  }

  async enterClientName(name: string): Promise<void> {
    const input = await this.page.$('.MuiDialog-root input');
    if (input) {
      await input.fill(name);
    }
  }

  async enterClientDescription(description: string): Promise<void> {
    await this.fill(this.selectors.descriptionInput, description);
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

  async createClient(name: string, description: string = ''): Promise<void> {
    await this.clickAddClientButton();
    await this.enterClientName(name);
    if (description) {
      await this.enterClientDescription(description);
    }
    await this.clickCreateButton();
    await this.waitForLoadingToDisappear();
    await this.page.waitForSelector(this.selectors.dialog, { state: 'hidden', timeout: 10000 });
  }

  async getClientCount(): Promise<number> {
    await this.waitForLoadingToDisappear();
    const noClients = await this.isVisible(this.selectors.noClientsMessage);
    if (noClients) {
      return 0;
    }
    const rows = await this.page.$$(this.selectors.tableRows);
    return rows.length;
  }

  async isClientInTable(clientName: string): Promise<boolean> {
    await this.waitForLoadingToDisappear();
    try {
      const row = await this.page.$(`tbody tr td:first-child:has-text("${clientName}")`);
      return row !== null;
    } catch {
      return false;
    }
  }

  async clickEditClientButton(clientName: string): Promise<void> {
    const row = await this.page.$(`tr:has-text("${clientName}")`);
    if (row) {
      const editBtn = await row.$('button:has([data-testid="EditIcon"])');
      if (editBtn) {
        await editBtn.click();
        await this.page.waitForSelector(this.selectors.dialog, { timeout: 5000 });
      }
    }
  }

  async clickDeleteClientButton(clientName: string): Promise<void> {
    const row = await this.page.$(`tr:has-text("${clientName}")`);
    if (row) {
      const deleteBtn = await row.$('button:has([data-testid="DeleteIcon"])');
      if (deleteBtn) {
        await deleteBtn.click();
      }
    }
  }

  async updateClient(oldName: string, newName: string, newDescription: string = ''): Promise<void> {
    await this.clickEditClientButton(oldName);
    await this.enterClientName(newName);
    if (newDescription) {
      await this.enterClientDescription(newDescription);
    }
    await this.clickUpdateButton();
    await this.waitForLoadingToDisappear();
    await this.page.waitForSelector(this.selectors.dialog, { state: 'hidden', timeout: 10000 });
  }

  async deleteClient(clientName: string): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await this.clickDeleteClientButton(clientName);
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

  async isNoClientsMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.noClientsMessage);
  }

  async isOnClientsPage(): Promise<boolean> {
    const url = await this.getUrl();
    return url.includes('/clients');
  }

  async waitForClientsToLoad(): Promise<void> {
    await this.waitForLoadingToDisappear();
    await this.waitForElement(this.selectors.pageTitle, 30000);
  }

  async getClientNames(): Promise<string[]> {
    await this.waitForLoadingToDisappear();
    const rows = await this.page.$$('tbody tr');
    const names: string[] = [];
    for (const row of rows) {
      const nameCell = await row.$('td:first-child');
      if (nameCell) {
        const text = await nameCell.textContent();
        if (text) {
          names.push(text.trim());
        }
      }
    }
    return names;
  }
}
