Feature: Clients API

  Background:
    Given a user "bdd-cl@example.com" exists

  # ── Create ──────────────────────────────────────────────────────────────────

  Scenario: Create a client with all fields
    When I POST "/api/clients" as "bdd-cl@example.com" with:
      | name      | department  | email            |
      | Acme Corp | Engineering | contact@acme.com |
    Then the status should be 201
    And the response at "message" should be "Client created successfully"
    And the response at "client.name" should be "Acme Corp"
    And the response at "client.department" should be "Engineering"

  Scenario: Create a client with only name
    When I POST "/api/clients" as "bdd-cl@example.com" with:
      | name     |
      | Beta Inc |
    Then the status should be 201
    And the response at "client.name" should be "Beta Inc"

  Scenario: Fail to create a client without name
    When I POST "/api/clients" as "bdd-cl@example.com" with:
      | description  |
      | no name      |
    Then the status should be 400
    And the response at "error" should be "Validation error"

  Scenario: Fail to create a client without authentication
    When I POST "/api/clients" without auth with:
      | name     |
      | Unauthed |
    Then the status should be 401

  # ── List ────────────────────────────────────────────────────────────────────

  Scenario: List all clients for the user
    Given a client named "ListClient A" exists for "bdd-cl@example.com"
    And a client named "ListClient B" exists for "bdd-cl@example.com"
    When I GET "/api/clients" as "bdd-cl@example.com"
    Then the status should be 200
    And the response at "clients" should have at least 2 items

  Scenario: Empty client list for a new user
    Given a user "bdd-cl-empty@example.com" exists
    When I GET "/api/clients" as "bdd-cl-empty@example.com"
    Then the status should be 200
    And the response at "clients" should be an empty array

  Scenario: Clients are isolated between users
    Given a client named "IsolatedCo" exists for "bdd-cl@example.com"
    When I GET "/api/clients" as "bdd-cl-empty@example.com"
    Then the response at "clients" should not contain name "IsolatedCo"

  # ── Get by ID ───────────────────────────────────────────────────────────────

  Scenario: Get a specific client by ID
    Given a client named "SpecificCo" exists for "bdd-cl@example.com"
    When I GET that client as "bdd-cl@example.com"
    Then the status should be 200
    And the response at "client.name" should be "SpecificCo"

  Scenario Outline: Get client with bad ID returns <status>
    When I GET "/api/clients/<id>" as "bdd-cl@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Cannot access another user's client
    Given a client named "PrivateCo" exists for "bdd-cl@example.com"
    When I GET that client as "bdd-cl-empty@example.com"
    Then the status should be 404

  # ── Update ──────────────────────────────────────────────────────────────────

  Scenario: Update client fields
    Given a client named "OldName" exists for "bdd-cl@example.com"
    When I PUT that client as "bdd-cl@example.com" with:
      | name    |
      | NewName |
    Then the status should be 200
    And the response at "message" should be "Client updated successfully"
    And the response at "client.name" should be "NewName"

  Scenario Outline: Update client with bad ID returns <status>
    When I PUT "/api/clients/<id>" as "bdd-cl@example.com" with:
      | name    |
      | Ghost   |
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Update client with empty body returns 400
    Given a client named "NoUpdateCo" exists for "bdd-cl@example.com"
    When I PUT that client as "bdd-cl@example.com" with empty body
    Then the status should be 400

  Scenario: Cannot update another user's client
    Given a client named "ProtectedCo" exists for "bdd-cl@example.com"
    When I PUT that client as "bdd-cl-empty@example.com" with:
      | name     |
      | Hijacked |
    Then the status should be 404

  # ── Delete ──────────────────────────────────────────────────────────────────

  Scenario: Delete a specific client
    Given a client named "ToDeleteCo" exists for "bdd-cl@example.com"
    When I DELETE that client as "bdd-cl@example.com"
    Then the status should be 200
    And the response at "message" should be "Client deleted successfully"
    And that client should no longer exist for "bdd-cl@example.com"

  Scenario Outline: Delete client with bad ID returns <status>
    When I DELETE "/api/clients/<id>" as "bdd-cl@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  # ── Bulk Delete ─────────────────────────────────────────────────────────────

  Scenario: Bulk delete all clients for a user
    Given a user "bdd-bulk@example.com" exists
    And a client named "BulkA" exists for "bdd-bulk@example.com"
    And a client named "BulkB" exists for "bdd-bulk@example.com"
    When I DELETE "/api/clients" as "bdd-bulk@example.com"
    Then the status should be 200
    And the response at "message" should be "All clients deleted successfully"
    And the response at "deletedCount" should be 2
