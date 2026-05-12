@dashboard
Feature: Dashboard Functionality
  As a logged-in user
  I want to view my dashboard
  So that I can see an overview of my time tracking data

  Background:
    Given I am logged in as "test@example.com"
    And I am on the dashboard page

  @positive @smoke
  Scenario: Dashboard displays all main elements
    Then I should see the dashboard title
    And I should see the Total Clients card
    And I should see the Total Work Entries card
    And I should see the dashboard Total Hours card
    And I should see the Recent Work Entries section
    And I should see the Quick Actions section

  @positive
  Scenario: Dashboard shows correct initial values for new user
    Given I am logged in as "fresh-dashboard-user@example.com"
    And I am on the dashboard page
    Then the Total Clients value should be "0"
    And the Total Work Entries value should be "0"
    And the Total Hours value should be "0.00"

  @positive
  Scenario: Navigate to Clients page from Quick Actions
    When I click the Add Client quick action button
    Then I should be on the clients page

  @positive
  Scenario: Navigate to Work Entries page from Quick Actions
    When I click the Add Work Entry quick action button
    Then I should be on the work entries page

  @positive
  Scenario: Navigate to Reports page from Quick Actions
    When I click the View Reports quick action button
    Then I should be on the reports page

  @positive
  Scenario: Navigate to Work Entries from Add Entry button
    When I click the Add Entry button in Recent Work Entries
    Then I should be on the work entries page

  @positive
  Scenario: Click on Total Clients card navigates to Clients page
    When I click on the Total Clients card
    Then I should be on the clients page

  @positive
  Scenario: Click on Total Work Entries card navigates to Work Entries page
    When I click on the Total Work Entries card
    Then I should be on the work entries page

  @positive
  Scenario: Click on Total Hours card navigates to Reports page
    When I click on the Total Hours card
    Then I should be on the reports page

  @negative
  Scenario: Dashboard shows no entries message when empty
    Given I am logged in as "empty-dashboard-user@example.com"
    And I am on the dashboard page
    Then I should see the no work entries message
