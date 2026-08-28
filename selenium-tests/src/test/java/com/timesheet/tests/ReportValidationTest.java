package com.timesheet.tests;

import com.timesheet.base.BaseTest;
import com.timesheet.pages.ClientsPage;
import com.timesheet.pages.DashboardPage;
import com.timesheet.pages.LoginPage;
import com.timesheet.pages.ReportsPage;
import com.timesheet.pages.WorkEntriesPage;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.testng.Assert;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.List;

/**
 * Functional Test Case 2: Gather report for added entries and validate.
 *
 * This test validates report generation and data integrity:
 * 1. Setup: Login, create client, add multiple work entries
 * 2. Navigate to Reports and select the client
 * 3. Validate total hours, entry count, and average
 * 4. Validate individual entry data (hours, descriptions)
 * 5. Validate export buttons are enabled
 */
public class ReportValidationTest extends BaseTest {

    private LoginPage loginPage;
    private DashboardPage dashboardPage;
    private ClientsPage clientsPage;
    private WorkEntriesPage workEntriesPage;
    private ReportsPage reportsPage;

    private static final String TEST_EMAIL_REPORT = "reporttest@example.com";
    private static final String CLIENT_NAME = "Beta Solutions";
    private static final String CLIENT_DEPARTMENT = "QA";

    // Work entries: 8 + 6.5 + 3.25 = 17.75 total hours
    private static final String ENTRY_1_HOURS = "8";
    private static final String ENTRY_1_DESC = "Sprint planning and development";
    private static final String ENTRY_2_HOURS = "6.5";
    private static final String ENTRY_2_DESC = "API integration testing";
    private static final String ENTRY_3_HOURS = "3.25";
    private static final String ENTRY_3_DESC = "Documentation and code review";

    @BeforeClass
    @Override
    public void setUp() {
        super.setUp();
        loginPage = new LoginPage(driver, wait);
        dashboardPage = new DashboardPage(driver, wait);
        clientsPage = new ClientsPage(driver, wait);
        workEntriesPage = new WorkEntriesPage(driver, wait);
        reportsPage = new ReportsPage(driver, wait);

        setupTestData();
    }

    private void setupTestData() {
        // Login
        loginPage.navigateTo(BASE_URL);
        loginPage.login(TEST_EMAIL_REPORT);
        wait.until(ExpectedConditions.urlContains("/dashboard"));
        dashboardPage.isDashboardDisplayed();

        // Create client
        dashboardPage.navigateToClients();
        wait.until(ExpectedConditions.urlContains("/clients"));
        clientsPage.isClientsPageDisplayed();
        clientsPage.createClient(CLIENT_NAME, CLIENT_DEPARTMENT);
        clientsPage.isClientDisplayed(CLIENT_NAME);

        // Add 3 work entries
        dashboardPage.navigateToWorkEntries();
        wait.until(ExpectedConditions.urlContains("/work-entries"));
        workEntriesPage.isWorkEntriesPageDisplayed();

        workEntriesPage.createWorkEntry(CLIENT_NAME, ENTRY_1_HOURS, ENTRY_1_DESC);
        workEntriesPage.createWorkEntry(CLIENT_NAME, ENTRY_2_HOURS, ENTRY_2_DESC);
        workEntriesPage.createWorkEntry(CLIENT_NAME, ENTRY_3_HOURS, ENTRY_3_DESC);
    }

    @Test(priority = 1, description = "Verify report displays correct total hours for all entries")
    public void testReportTotalHours() {
        dashboardPage.navigateToReports();
        wait.until(ExpectedConditions.urlContains("/reports"));
        Assert.assertTrue(reportsPage.isReportsPageDisplayed(), "Reports page should be displayed");

        reportsPage.selectClient(CLIENT_NAME);

        String totalHours = reportsPage.getTotalHours();
        Assert.assertTrue(totalHours.contains("17.75"),
                "Total hours should be 17.75 (8 + 6.5 + 3.25). Found: " + totalHours);
    }

    @Test(priority = 2, dependsOnMethods = "testReportTotalHours",
            description = "Verify report shows correct total entry count")
    public void testReportEntryCount() {
        String totalEntries = reportsPage.getTotalEntries();
        Assert.assertTrue(totalEntries.contains("3"),
                "Total entries should be 3. Found: " + totalEntries);
    }

    @Test(priority = 3, dependsOnMethods = "testReportTotalHours",
            description = "Verify report contains all three entries with correct descriptions")
    public void testReportEntriesContent() {
        Assert.assertTrue(reportsPage.isEntryPresent(ENTRY_1_DESC),
                "Report should contain entry: " + ENTRY_1_DESC);
        Assert.assertTrue(reportsPage.isEntryPresent(ENTRY_2_DESC),
                "Report should contain entry: " + ENTRY_2_DESC);
        Assert.assertTrue(reportsPage.isEntryPresent(ENTRY_3_DESC),
                "Report should contain entry: " + ENTRY_3_DESC);
    }

    @Test(priority = 4, dependsOnMethods = "testReportTotalHours",
            description = "Verify report entries have correct hours values")
    public void testReportEntryHours() {
        List<WebElement> entries = reportsPage.getReportEntries();
        Assert.assertEquals(entries.size(), 3, "Report should have exactly 3 entries");

        boolean hasEntry1Hours = false;
        boolean hasEntry2Hours = false;
        boolean hasEntry3Hours = false;

        for (int i = 0; i < entries.size(); i++) {
            String hours = reportsPage.getEntryHours(i);
            if (hours.contains("8")) hasEntry1Hours = true;
            if (hours.contains("6.5")) hasEntry2Hours = true;
            if (hours.contains("3.25")) hasEntry3Hours = true;
        }

        Assert.assertTrue(hasEntry1Hours, "Report should contain 8 hours entry");
        Assert.assertTrue(hasEntry2Hours, "Report should contain 6.5 hours entry");
        Assert.assertTrue(hasEntry3Hours, "Report should contain 3.25 hours entry");
    }

    @Test(priority = 5, dependsOnMethods = "testReportTotalHours",
            description = "Verify CSV and PDF export buttons are enabled when report is displayed")
    public void testExportButtonsEnabled() {
        Assert.assertTrue(reportsPage.isExportCsvEnabled(),
                "Export CSV button should be enabled");
        Assert.assertTrue(reportsPage.isExportPdfEnabled(),
                "Export PDF button should be enabled");
    }
}
