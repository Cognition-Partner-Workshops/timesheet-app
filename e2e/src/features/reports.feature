@reports
Feature: Reports Functionality
  As a logged-in user
  I want to view and export reports
  So that I can analyze time spent on clients

  Background:
    Given I am logged in as "test@example.com"

  @positive @smoke
  Scenario: Reports page displays correctly
    Given a client "Test Client" exists
    And I am on the reports page
    Then I should see the reports page title
    And I should see the client selector

  @positive
  Scenario: View report for a client with work entries
    Given a client "Test Client" exists
    And a work entry for "Test Client" with "8" hours exists
    And I am on the reports page
    When I select client "Test Client" from the dropdown
    Then I should see the Total Hours card
    And I should see the Total Entries card
    And I should see the Average Hours per Entry card
    And I should see the report table with entries

  @positive
  Scenario: Report shows correct totals
    Given a client "Totals Report Client" exists
    And a work entry for "Totals Report Client" with "4" hours exists
    And a work entry for "Totals Report Client" with "6" hours exists
    And I am on the reports page
    When I select client "Totals Report Client" from the dropdown
    Then the Total Hours should be "10.00"
    And the Total Entries should be "2"
    And the Average Hours per Entry should be "5.00"

  @positive
  Scenario: Export report as CSV
    Given a client "Test Client" exists
    And a work entry for "Test Client" with "8" hours exists
    And I am on the reports page
    When I select client "Test Client" from the dropdown
    And I click the CSV export button
    Then the CSV file should be downloaded

  @positive
  Scenario: Export report as PDF
    Given a client "Test Client" exists
    And a work entry for "Test Client" with "8" hours exists
    And I am on the reports page
    When I select client "Test Client" from the dropdown
    And I click the PDF export button
    Then the PDF file should be downloaded

  @positive
  Scenario: Switch between different clients
    Given a client "Client A" exists
    And a client "Client B" exists
    And a work entry for "Client A" with "4" hours exists
    And a work entry for "Client B" with "8" hours exists
    And I am on the reports page
    When I select client "Client A" from the dropdown
    Then the Total Hours should be "4.00"
    When I select client "Client B" from the dropdown
    Then the Total Hours should be "8.00"

  @negative
  Scenario: Reports page shows message when no clients exist
    Given I am logged in as "no-clients-user@example.com"
    Given no clients exist
    And I am on the reports page
    Then I should see the create client first message on reports

  @negative
  Scenario: Reports page shows select client message initially
    Given a client "Test Client" exists
    And I am on the reports page
    Then I should see the select client message

  @negative
  Scenario: Report shows no entries message for client without work entries
    Given a client "Empty Client" exists
    And no work entries exist for "Empty Client"
    And I am on the reports page
    When I select client "Empty Client" from the dropdown
    Then I should see the no work entries for client message

  @negative
  Scenario: Export buttons are disabled when no client is selected
    Given a client "Test Client" exists
    And I am on the reports page
    Then the CSV export button should be disabled
    And the PDF export button should be disabled
