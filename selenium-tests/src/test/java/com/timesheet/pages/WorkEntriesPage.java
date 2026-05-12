package com.timesheet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.util.List;

public class WorkEntriesPage {

    private WebDriver driver;
    private WebDriverWait wait;

    private By pageTitle = By.cssSelector("h4");
    private By addWorkEntryButton = By.xpath("//button[contains(.,'Add Work Entry')]");
    private By clientDropdown = By.xpath("//form//div[@aria-expanded='false' or @aria-expanded='true']");
    private By hoursInput = By.cssSelector("form input[type='number']");
    private By descriptionInput = By.cssSelector("form textarea");
    private By createButton = By.xpath("//button[@type='submit'][contains(.,'Create')]");

    public WorkEntriesPage(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
    }

    public boolean isWorkEntriesPageDisplayed() {
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(pageTitle));
        return title.getText().contains("Work Entries");
    }

    public void clickAddWorkEntry() {
        WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(addWorkEntryButton));
        btn.click();
    }

    public void selectClient(String clientName) {
        WebElement dropdown = wait.until(ExpectedConditions.elementToBeClickable(clientDropdown));
        dropdown.click();

        WebElement option = wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//li[contains(text(),'" + clientName + "')]")));
        option.click();
    }

    public void enterHours(String hours) {
        WebElement input = wait.until(ExpectedConditions.visibilityOfElementLocated(hoursInput));
        input.clear();
        input.sendKeys(hours);
    }

    public void enterDescription(String description) {
        WebElement input = wait.until(ExpectedConditions.visibilityOfElementLocated(descriptionInput));
        input.clear();
        input.sendKeys(description);
    }

    public void submitWorkEntry() {
        WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(createButton));
        btn.click();
    }

    public void createWorkEntry(String clientName, String hours, String description) {
        clickAddWorkEntry();
        // Wait for dialog to appear
        wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//h2[contains(.,'Add New Work Entry')]")));
        selectClient(clientName);
        enterHours(hours);
        enterDescription(description);
        submitWorkEntry();
        // Wait for the dialog to close
        wait.until(ExpectedConditions.invisibilityOfElementLocated(
                By.xpath("//div[@aria-modal='true']")));
        // Small wait for table refresh
        try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    public boolean isWorkEntryDisplayed(String description) {
        try {
            // Use a shorter substring for matching in case of truncation
            String searchText = description.length() > 20 ? description.substring(0, 20) : description;
            WebElement entry = wait.until(ExpectedConditions.visibilityOfElementLocated(
                    By.xpath("//table/tbody//td[contains(.,'" + searchText + "')]")));
            return entry.isDisplayed();
        } catch (Exception e) {
            return false;
        }
    }

    public int getWorkEntryCount() {
        try {
            List<WebElement> rows = driver.findElements(
                    By.xpath("//table/tbody/tr[not(contains(.,'No work entries'))]"));
            return rows.size();
        } catch (Exception e) {
            return 0;
        }
    }
}
