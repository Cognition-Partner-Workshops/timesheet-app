package com.timesheet.tests;

import com.timesheet.base.BaseTest;
import com.timesheet.pages.ClientsPage;
import com.timesheet.pages.DashboardPage;
import com.timesheet.pages.LoginPage;
import com.timesheet.pages.WorkEntriesPage;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.testng.Assert;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

/**
 * Functional Test Case 1: Login with email and log work entries.
 *
 * This test validates the complete user flow:
 * 1. Login with email (auto-provisioning on first login)
 * 2. Verify dashboard is displayed with user email
 * 3. Create a new client
 * 4. Log work entries for that client
 * 5. Verify work entries are listed
 */
public class LoginAndLogEntryTest extends BaseTest {

    private LoginPage loginPage;
    private DashboardPage dashboardPage;
    private ClientsPage clientsPage;
    private WorkEntriesPage workEntriesPage;

    private static final String CLIENT_NAME = "Acme Corp";
    private static final String CLIENT_DEPARTMENT = "Engineering";

    @BeforeClass
    @Override
    public void setUp() {
        super.setUp();
        loginPage = new LoginPage(driver, wait);
        dashboardPage = new DashboardPage(driver, wait);
        clientsPage = new ClientsPage(driver, wait);
        workEntriesPage = new WorkEntriesPage(driver, wait);
    }

    @Test(priority = 1, description = "Verify user can login with a valid email and is auto-provisioned")
    public void testLoginWithEmail() {
        loginPage.navigateTo(BASE_URL);
        Assert.assertTrue(loginPage.isLoginPageDisplayed(), "Login page should be displayed");

        loginPage.login(TEST_EMAIL);

        // Wait for URL to change to dashboard
        wait.until(ExpectedConditions.urlContains("/dashboard"));
        Assert.assertTrue(dashboardPage.isDashboardDisplayed(),
                "Dashboard should be displayed after login");
    }

    @Test(priority = 2, dependsOnMethods = "testLoginWithEmail",
            description = "Verify logged-in user email is displayed in the header")
    public void testUserEmailDisplayed() {
        String headerText = dashboardPage.getUserEmail();
        Assert.assertTrue(headerText.contains(TEST_EMAIL),
                "User email should be displayed in the header. Found: " + headerText);
    }

    @Test(priority = 3, dependsOnMethods = "testLoginWithEmail",
            description = "Verify user can navigate to Clients and create a new client")
    public void testCreateClient() {
        dashboardPage.navigateToClients();
        wait.until(ExpectedConditions.urlContains("/clients"));
        Assert.assertTrue(clientsPage.isClientsPageDisplayed(), "Clients page should be displayed");

        clientsPage.createClient(CLIENT_NAME, CLIENT_DEPARTMENT);

        Assert.assertTrue(clientsPage.isClientDisplayed(CLIENT_NAME),
                "Created client '" + CLIENT_NAME + "' should be visible in the clients table");
    }

    @Test(priority = 4, dependsOnMethods = "testCreateClient",
            description = "Verify user can log a first work entry for the created client")
    public void testLogFirstWorkEntry() {
        dashboardPage.navigateToWorkEntries();
        wait.until(ExpectedConditions.urlContains("/work-entries"));
        Assert.assertTrue(workEntriesPage.isWorkEntriesPageDisplayed(),
                "Work Entries page should be displayed");

        workEntriesPage.createWorkEntry(CLIENT_NAME, "4.5",
                "Implemented feature X - development sprint");

        Assert.assertTrue(workEntriesPage.isWorkEntryDisplayed(
                "Implemented feature X - development sprint"),
                "First work entry should be visible in the work entries table");
    }

    @Test(priority = 5, dependsOnMethods = "testLogFirstWorkEntry",
            description = "Verify user can log a second work entry for the same client")
    public void testLogSecondWorkEntry() {
        workEntriesPage.createWorkEntry(CLIENT_NAME, "3.25",
                "Code review and bug fixes");

        Assert.assertTrue(workEntriesPage.isWorkEntryDisplayed("Code review and bug fixes"),
                "Second work entry should be visible in the work entries table");
    }

    @Test(priority = 6, dependsOnMethods = "testLogSecondWorkEntry",
            description = "Verify all work entries are listed for the authenticated user")
    public void testAllWorkEntriesListed() {
        int entryCount = workEntriesPage.getWorkEntryCount();
        Assert.assertEquals(entryCount, 2,
                "Should have exactly 2 work entries listed");
    }
}
