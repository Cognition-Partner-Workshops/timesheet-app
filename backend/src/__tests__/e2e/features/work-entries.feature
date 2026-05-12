Feature: Work Entries API

  Scenario: Create a work entry
    Given a user "bdd-we@example.com" exists
    And a client named "ProjectAlpha" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with 4.5 hours on "2025-01-15" described "Backend dev"
    Then the response status should be 201
    And the response body "message" should equal "Work entry created successfully"
    And the response body path "workEntry.hours" should equal 4.5
    And the response body path "workEntry.client_name" should equal "ProjectAlpha"

  Scenario: Create a work entry without description
    Given a user "bdd-we@example.com" exists
    And a client named "ProjectBeta" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with 2 hours on "2025-01-16"
    Then the response status should be 201

  Scenario: Fail to create with missing required fields
    Given a user "bdd-we@example.com" exists
    When I send an authenticated POST to "/api/work-entries" as "bdd-we@example.com" with body {"description":"missing fields"}
    Then the response status should be 400
    And the response body "error" should equal "Validation error"

  Scenario: Fail to create with hours exceeding 24
    Given a user "bdd-we@example.com" exists
    And a client named "ProjectAlpha" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with 25 hours on "2025-01-15"
    Then the response status should be 400

  Scenario: Fail to create for non-existent client
    Given a user "bdd-we@example.com" exists
    When I create a work entry on client 99999 as "bdd-we@example.com" with 1 hours on "2025-01-15"
    Then the response status should be 400
    And the response body "error" should equal "Client not found or does not belong to user"

  Scenario: Fail to create without authentication
    When I send an unauthenticated POST to "/api/work-entries" with body {"clientId":1,"hours":1,"date":"2025-01-15"}
    Then the response status should be 401

  Scenario: List all work entries
    Given a user "bdd-we@example.com" exists
    When I list work entries as "bdd-we@example.com"
    Then the response status should be 200
    And the response body path "workEntries" should be an array

  Scenario: Filter work entries by clientId
    Given a user "bdd-we@example.com" exists
    And a client named "FilterClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 3 hours on "2025-02-10"
    When I list work entries filtered by that client as "bdd-we@example.com"
    Then the response status should be 200
    And all returned work entries should belong to that client

  Scenario: Filter with invalid clientId returns 400
    Given a user "bdd-we@example.com" exists
    When I send an authenticated GET to "/api/work-entries?clientId=abc" as "bdd-we@example.com"
    Then the response status should be 400

  Scenario: Work entries are isolated between users
    Given a user "bdd-we-other@example.com" exists
    When I list work entries as "bdd-we-other@example.com"
    Then the response status should be 200
    And the response body path "workEntries" should be an empty array

  Scenario: Get a specific work entry by ID
    Given a user "bdd-we@example.com" exists
    And a client named "GetEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 7 hours on "2025-03-01"
    When I get that work entry as "bdd-we@example.com"
    Then the response status should be 200
    And the response body path "workEntry.hours" should equal 7

  Scenario: Get non-existent work entry returns 404
    Given a user "bdd-we@example.com" exists
    When I get work entry 99999 as "bdd-we@example.com"
    Then the response status should be 404

  Scenario: Get work entry with invalid ID returns 400
    Given a user "bdd-we@example.com" exists
    When I get work entry "abc" as "bdd-we@example.com"
    Then the response status should be 400

  Scenario: Cannot access another user's work entry
    Given a user "bdd-we@example.com" exists
    And a client named "PrivateEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-03-05"
    When I get that work entry as "bdd-we-other@example.com"
    Then the response status should be 404

  Scenario: Update work entry fields
    Given a user "bdd-we@example.com" exists
    And a client named "UpdateEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 2 hours on "2025-04-01"
    When I update that work entry as "bdd-we@example.com" with hours 6
    Then the response status should be 200
    And the response body "message" should equal "Work entry updated successfully"
    And the response body path "workEntry.hours" should equal 6

  Scenario: Update work entry client assignment
    Given a user "bdd-we@example.com" exists
    And a client named "SourceClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-05"
    And a client named "TargetClient" exists for "bdd-we@example.com"
    When I reassign that work entry to the latest client as "bdd-we@example.com"
    Then the response status should be 200
    And the response body path "workEntry.client_name" should equal "TargetClient"

  Scenario: Update non-existent work entry returns 404
    Given a user "bdd-we@example.com" exists
    When I update work entry 99999 as "bdd-we@example.com" with hours 1
    Then the response status should be 404

  Scenario: Update work entry with invalid ID returns 400
    Given a user "bdd-we@example.com" exists
    When I update work entry "abc" as "bdd-we@example.com" with hours 1
    Then the response status should be 400

  Scenario: Update work entry with empty body returns 400
    Given a user "bdd-we@example.com" exists
    And a client named "EmptyUpdateClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-10"
    When I update that work entry as "bdd-we@example.com" with empty body
    Then the response status should be 400

  Scenario: Cannot reassign to non-existent client
    Given a user "bdd-we@example.com" exists
    And a client named "ReassignFailClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-12"
    When I reassign that work entry to client 99999 as "bdd-we@example.com"
    Then the response status should be 400

  Scenario: Cannot update another user's work entry
    Given a user "bdd-we@example.com" exists
    And a client named "OtherUserEntry" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-15"
    When I update that work entry as "bdd-we-other@example.com" with hours 1
    Then the response status should be 404

  Scenario: Delete a work entry
    Given a user "bdd-we@example.com" exists
    And a client named "DeleteEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-05-01"
    When I delete that work entry as "bdd-we@example.com"
    Then the response status should be 200
    And the response body "message" should equal "Work entry deleted successfully"
    And that work entry should no longer exist for "bdd-we@example.com"

  Scenario: Delete non-existent work entry returns 404
    Given a user "bdd-we@example.com" exists
    When I delete work entry 99999 as "bdd-we@example.com"
    Then the response status should be 404

  Scenario: Delete work entry with invalid ID returns 400
    Given a user "bdd-we@example.com" exists
    When I delete work entry "abc" as "bdd-we@example.com"
    Then the response status should be 400

  Scenario: Cannot delete another user's work entry
    Given a user "bdd-we@example.com" exists
    And a client named "ProtectedEntry" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-05-05"
    When I delete that work entry as "bdd-we-other@example.com"
    Then the response status should be 404
