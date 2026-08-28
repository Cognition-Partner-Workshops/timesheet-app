Feature: Work Entries API

  Background:
    Given a user "bdd-we@example.com" exists

  # ── Create ──────────────────────────────────────────────────────────────────

  Scenario: Create a work entry with description
    Given a client named "ProjectAlpha" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with:
      | hours | date       | description |
      | 4.5   | 2025-01-15 | Backend dev |
    Then the status should be 201
    And the response at "message" should be "Work entry created successfully"
    And the response at "workEntry.hours" should be 4.5
    And the response at "workEntry.client_name" should be "ProjectAlpha"

  Scenario: Create a work entry without description
    Given a client named "ProjectBeta" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with:
      | hours | date       |
      | 2     | 2025-01-16 |
    Then the status should be 201

  Scenario: Fail to create with missing required fields
    When I POST "/api/work-entries" as "bdd-we@example.com" with:
      | description    |
      | missing fields |
    Then the status should be 400
    And the response at "error" should be "Validation error"

  Scenario: Fail to create with hours exceeding 24
    Given a client named "ProjectAlpha" exists for "bdd-we@example.com"
    When I create a work entry on that client as "bdd-we@example.com" with:
      | hours | date       |
      | 25    | 2025-01-15 |
    Then the status should be 400

  Scenario: Fail to create for non-existent client
    When I create a work entry on client 99999 as "bdd-we@example.com" with:
      | hours | date       |
      | 1     | 2025-01-15 |
    Then the status should be 400
    And the response at "error" should be "Client not found or does not belong to user"

  Scenario: Fail to create without authentication
    When I POST "/api/work-entries" without auth with:
      | clientId | hours | date       |
      | 1        | 1     | 2025-01-15 |
    Then the status should be 401

  # ── List ────────────────────────────────────────────────────────────────────

  Scenario: List all work entries
    When I GET "/api/work-entries" as "bdd-we@example.com"
    Then the status should be 200
    And the response at "workEntries" should be an array

  Scenario: Filter work entries by clientId
    Given a client named "FilterClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 3 hours on "2025-02-10"
    When I GET work entries filtered by that client as "bdd-we@example.com"
    Then the status should be 200
    And all returned work entries should belong to that client

  Scenario: Filter with invalid clientId returns 400
    When I GET "/api/work-entries?clientId=abc" as "bdd-we@example.com"
    Then the status should be 400

  Scenario: Work entries are isolated between users
    Given a user "bdd-we-other@example.com" exists
    When I GET "/api/work-entries" as "bdd-we-other@example.com"
    Then the status should be 200
    And the response at "workEntries" should be an empty array

  # ── Get by ID ───────────────────────────────────────────────────────────────

  Scenario: Get a specific work entry by ID
    Given a client named "GetEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 7 hours on "2025-03-01"
    When I GET that work entry as "bdd-we@example.com"
    Then the status should be 200
    And the response at "workEntry.hours" should be 7

  Scenario Outline: Get work entry with bad ID returns <status>
    When I GET "/api/work-entries/<id>" as "bdd-we@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Cannot access another user's work entry
    Given a client named "PrivateEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-03-05"
    When I GET that work entry as "bdd-we-other@example.com"
    Then the status should be 404

  # ── Update ──────────────────────────────────────────────────────────────────

  Scenario: Update work entry fields
    Given a client named "UpdateEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 2 hours on "2025-04-01"
    When I PUT that work entry as "bdd-we@example.com" with:
      | hours |
      | 6     |
    Then the status should be 200
    And the response at "message" should be "Work entry updated successfully"
    And the response at "workEntry.hours" should be 6

  Scenario: Update work entry client assignment
    Given a client named "SourceClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-05"
    And a client named "TargetClient" exists for "bdd-we@example.com"
    When I reassign that work entry to the latest client as "bdd-we@example.com"
    Then the status should be 200
    And the response at "workEntry.client_name" should be "TargetClient"

  Scenario Outline: Update work entry with bad ID returns <status>
    When I PUT "/api/work-entries/<id>" as "bdd-we@example.com" with:
      | hours |
      | 1     |
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Update work entry with empty body returns 400
    Given a client named "EmptyUpdateClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-10"
    When I PUT that work entry as "bdd-we@example.com" with empty body
    Then the status should be 400

  Scenario: Cannot reassign to non-existent client
    Given a client named "ReassignFailClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-12"
    When I reassign that work entry to client 99999 as "bdd-we@example.com"
    Then the status should be 400

  Scenario: Cannot update another user's work entry
    Given a client named "OtherUserEntry" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-04-15"
    When I PUT that work entry as "bdd-we-other@example.com" with:
      | hours |
      | 1     |
    Then the status should be 404

  # ── Delete ──────────────────────────────────────────────────────────────────

  Scenario: Delete a work entry
    Given a client named "DeleteEntryClient" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-05-01"
    When I DELETE that work entry as "bdd-we@example.com"
    Then the status should be 200
    And the response at "message" should be "Work entry deleted successfully"
    And that work entry should no longer exist for "bdd-we@example.com"

  Scenario Outline: Delete work entry with bad ID returns <status>
    When I DELETE "/api/work-entries/<id>" as "bdd-we@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Cannot delete another user's work entry
    Given a client named "ProtectedEntry" exists for "bdd-we@example.com"
    And a work entry exists on that client for "bdd-we@example.com" with 1 hours on "2025-05-05"
    When I DELETE that work entry as "bdd-we-other@example.com"
    Then the status should be 404
