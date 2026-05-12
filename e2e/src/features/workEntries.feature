@workEntries
Feature: Work Entries Management
  As a logged-in user
  I want to manage my work entries
  So that I can track time spent on different clients

  Background:
    Given I am logged in as "test@example.com"

  @positive @smoke
  Scenario: Work Entries page displays correctly
    Given I am on the work entries page
    Then I should see the work entries page title
    And I should see the Add Work Entry button

  @positive
  Scenario: Create a new work entry
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    Then I should see the Add New Work Entry dialog
    When I select client "Test Client"
    And I enter hours "8"
    And I enter work description "Development work"
    And I click the Create button
    Then the work entry for "Test Client" with "8" hours should appear in the table

  @positive
  Scenario: Create work entry with minimum hours
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "0.5"
    And I click the Create button
    Then the work entry for "Test Client" with "0.5" hours should appear in the table

  @positive
  Scenario: Create work entry with maximum hours
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "24"
    And I click the Create button
    Then the work entry for "Test Client" with "24" hours should appear in the table

  @positive
  Scenario: Edit an existing work entry
    Given a client "Test Client" exists
    And a work entry for "Test Client" with "4" hours exists
    And I am on the work entries page
    When I click the edit button for work entry "Test Client"
    Then I should see the Edit Work Entry dialog
    When I update the hours to "6"
    And I click the Update button
    Then the work entry for "Test Client" with "6" hours should appear in the table

  @positive
  Scenario: Delete an existing work entry
    Given a client "Delete Test Client" exists
    And a work entry for "Delete Test Client" with "4" hours exists
    And I am on the work entries page
    When I click the delete button for work entry "Delete Test Client"
    And I confirm the deletion
    Then the work entry for "Delete Test Client" should not appear in the table

  @positive
  Scenario: Cancel work entry creation
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "5"
    And I click the Cancel button
    Then the dialog should be closed

  @negative
  Scenario: Cannot create work entry without selecting client
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I enter hours "8"
    And I click the Create button
    Then I should see a client selection required error

  @negative
  Scenario: Cannot create work entry with zero hours
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "0"
    And I click the Create button
    Then I should see an hours validation error

  @negative
  Scenario: Cannot create work entry with negative hours
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "-5"
    And I click the Create button
    Then I should see an hours validation error

  @negative
  Scenario: Cannot create work entry with hours exceeding 24
    Given a client "Test Client" exists
    And I am on the work entries page
    When I click the Add Work Entry button
    And I select client "Test Client"
    And I enter hours "25"
    And I click the Create button
    Then I should see an hours validation error

  @negative
  Scenario: Work entries page shows message when no clients exist
    Given no clients exist
    And I am on the work entries page
    Then I should see the create client first message

  @negative
  Scenario: Empty work entries table shows appropriate message
    Given a client "Test Client" exists
    And no work entries exist
    And I am on the work entries page
    Then I should see the no work entries found message
