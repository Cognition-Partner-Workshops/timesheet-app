package com.timesheet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.util.List;

public class ReportsPage {

    private WebDriver driver;
    private WebDriverWait wait;

    private By pageTitle = By.cssSelector("h4");
    private By clientDropdown = By.xpath("//div[@aria-expanded='false' or @aria-expanded='true']");
    private By exportCsvButton = By.xpath("//button[@aria-label='Export as CSV']");
    private By exportPdfButton = By.xpath("//button[@aria-label='Export as PDF']");

    public ReportsPage(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
    }

    public boolean isReportsPageDisplayed() {
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(pageTitle));
        return title.getText().contains("Reports");
    }

    public void selectClient(String clientName) {
        WebElement dropdown = wait.until(ExpectedConditions.elementToBeClickable(clientDropdown));
        dropdown.click();

        WebElement option = wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//li[contains(text(),'" + clientName + "')]")));
        option.click();

        // Wait for report data to load
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//table/tbody/tr")));
    }

    public String getTotalHours() {
        WebElement el = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(text(),'Total Hours')]/ancestor::div[1]")));
        return el.getText();
    }

    public String getTotalEntries() {
        WebElement el = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(text(),'Total Entries')]/ancestor::div[1]")));
        return el.getText();
    }

    public String getAverageHoursPerEntry() {
        WebElement el = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(text(),'Average Hours per Entry')]/ancestor::div[1]")));
        return el.getText();
    }

    public List<WebElement> getReportEntries() {
        return driver.findElements(By.xpath("//table/tbody/tr"));
    }

    public boolean isEntryPresent(String description) {
        try {
            // Use a shorter substring for matching in case of truncation
            String searchText = description.length() > 20 ? description.substring(0, 20) : description;
            WebElement entry = driver.findElement(
                    By.xpath("//table/tbody/tr/td[contains(.,'" + searchText + "')]"));
            return entry.isDisplayed();
        } catch (Exception e) {
            return false;
        }
    }

    public String getEntryHours(int rowIndex) {
        List<WebElement> rows = getReportEntries();
        if (rowIndex < rows.size()) {
            WebElement hoursCell = rows.get(rowIndex).findElement(By.xpath(".//td[2]"));
            return hoursCell.getText();
        }
        return "";
    }

    public String getEntryDescription(int rowIndex) {
        List<WebElement> rows = getReportEntries();
        if (rowIndex < rows.size()) {
            WebElement descCell = rows.get(rowIndex).findElement(By.xpath(".//td[3]"));
            return descCell.getText();
        }
        return "";
    }

    public boolean isExportCsvEnabled() {
        WebElement btn = wait.until(ExpectedConditions.presenceOfElementLocated(exportCsvButton));
        return btn.isEnabled();
    }

    public boolean isExportPdfEnabled() {
        WebElement btn = wait.until(ExpectedConditions.presenceOfElementLocated(exportPdfButton));
        return btn.isEnabled();
    }
}
