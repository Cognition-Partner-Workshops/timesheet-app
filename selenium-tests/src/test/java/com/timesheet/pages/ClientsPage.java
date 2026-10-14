package com.timesheet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class ClientsPage {

    private WebDriver driver;
    private WebDriverWait wait;

    private By pageTitle = By.cssSelector("h4");
    private By addClientButton = By.xpath("//button[contains(.,'Add Client')]");
    private By clientNameInput = By.xpath("//form//label[contains(.,'Client Name')]/following-sibling::div//input | //form//div[1]//input[@type='text']");
    private By departmentInput = By.xpath("//form//label[contains(.,'Department')]/following-sibling::div//input | //form//div[2]//input[@type='text']");
    private By createButton = By.xpath("//button[@type='submit'][contains(.,'Create')]");

    public ClientsPage(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
    }

    public boolean isClientsPageDisplayed() {
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(pageTitle));
        return title.getText().contains("Clients");
    }

    public void clickAddClient() {
        WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(addClientButton));
        btn.click();
    }

    public void fillClientName(String name) {
        WebElement input = wait.until(ExpectedConditions.visibilityOfElementLocated(clientNameInput));
        input.clear();
        input.sendKeys(name);
    }

    public void fillDepartment(String department) {
        WebElement input = wait.until(ExpectedConditions.visibilityOfElementLocated(departmentInput));
        input.clear();
        input.sendKeys(department);
    }

    public void submitClient() {
        WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(createButton));
        btn.click();
    }

    public void createClient(String name, String department) {
        clickAddClient();
        fillClientName(name);
        fillDepartment(department);
        submitClient();
    }

    public boolean isClientDisplayed(String clientName) {
        try {
            WebElement clientRow = wait.until(ExpectedConditions.visibilityOfElementLocated(
                    By.xpath("//td//h6[text()='" + clientName + "']")));
            return clientRow.isDisplayed();
        } catch (Exception e) {
            return false;
        }
    }
}
