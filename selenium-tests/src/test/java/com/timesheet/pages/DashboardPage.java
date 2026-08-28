package com.timesheet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class DashboardPage {

    private WebDriver driver;
    private WebDriverWait wait;

    private By dashboardTitle = By.cssSelector("h4");
    private By userEmailDisplay = By.cssSelector("header");
    private By clientsNavLink = By.xpath("//div[@tabindex='0'][contains(.,'Clients')]");
    private By workEntriesNavLink = By.xpath("//div[@tabindex='0'][contains(.,'Work Entries')]");
    private By reportsNavLink = By.xpath("//div[@tabindex='0'][contains(.,'Reports')]");

    public DashboardPage(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
    }

    public boolean isDashboardDisplayed() {
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(dashboardTitle));
        return title.getText().contains("Dashboard");
    }

    public String getUserEmail() {
        WebElement header = wait.until(ExpectedConditions.visibilityOfElementLocated(userEmailDisplay));
        return header.getText();
    }

    public void navigateToClients() {
        WebElement link = wait.until(ExpectedConditions.elementToBeClickable(clientsNavLink));
        link.click();
    }

    public void navigateToWorkEntries() {
        WebElement link = wait.until(ExpectedConditions.elementToBeClickable(workEntriesNavLink));
        link.click();
    }

    public void navigateToReports() {
        WebElement link = wait.until(ExpectedConditions.elementToBeClickable(reportsNavLink));
        link.click();
    }
}
