# Selenium Functional Tests

Automated UI functional tests for the Timesheet application using **Selenium WebDriver**, **Java 11+**, and **TestNG**.

## Tech Stack

- **Selenium WebDriver 4.18** - Browser automation
- **TestNG 7.9** - Test framework
- **Java 11+** - Programming language
- **Maven** - Build and dependency management
- **Page Object Model** - Design pattern for maintainability

## Test Cases

### Test Case 1: Login with Email and Log Entry (`LoginAndLogEntryTest`)
1. Login with email (auto-provisioned user)
2. Verify user email is displayed in header
3. Create a new client
4. Log first work entry for the client
5. Log second work entry
6. Verify all entries are listed

### Test Case 2: Report Validation (`ReportValidationTest`)
1. Setup: Create user, client, and 3 work entries (8h + 6.5h + 3.25h = 17.75h)
2. Verify report total hours (17.75)
3. Verify entry count (3)
4. Validate individual entry descriptions
5. Validate entry hours
6. Verify export buttons are enabled

## Prerequisites

1. Java 11+ installed
2. Maven installed
3. Chrome/Chromium browser installed
4. ChromeDriver matching your Chrome version
5. App running (backend on port 3001, frontend on port 5173)

## Running Tests

```bash
# Start the app first
cd ../backend && npm run dev &
cd ../frontend && npm run dev &

# Run tests (default: http://localhost:5173)
cd selenium-tests
mvn test

# With custom Chrome binary and driver
mvn test -Dchrome.binary=/path/to/chrome -Dwebdriver.chrome.driver=/path/to/chromedriver

# With custom app URL
mvn test -Dapp.url=http://localhost:3000
```

## Project Structure

```
selenium-tests/
├── pom.xml                          # Maven config with dependencies
├── src/test/
│   ├── java/com/timesheet/
│   │   ├── base/
│   │   │   └── BaseTest.java        # WebDriver setup/teardown
│   │   ├── pages/
│   │   │   ├── LoginPage.java       # Login page object
│   │   │   ├── DashboardPage.java   # Dashboard page object
│   │   │   ├── ClientsPage.java     # Clients page object
│   │   │   ├── WorkEntriesPage.java # Work entries page object
│   │   │   └── ReportsPage.java     # Reports page object
│   │   └── tests/
│   │       ├── LoginAndLogEntryTest.java   # Test Case 1
│   │       └── ReportValidationTest.java   # Test Case 2
│   └── resources/
│       └── testng.xml               # TestNG suite configuration
└── README.md
```
