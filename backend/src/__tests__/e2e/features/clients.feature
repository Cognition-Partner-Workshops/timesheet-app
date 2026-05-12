Feature: Clients API

  Scenario: Create a client with all fields
    Given a user "bdd-cl@example.com" exists
    When I create a client "Acme Corp" as "bdd-cl@example.com" with department "Engineering" and email "contact@acme.com"
    Then the response status should be 201
    And the response body "message" should equal "Client created successfully"
    And the nested response "client.name" should equal "Acme Corp"
    And the nested response "client.department" should equal "Engineering"

  Scenario: Create a client with only name
    Given a user "bdd-cl@example.com" exists
    When I create a client named "Beta Inc" as "bdd-cl@example.com"
    Then the response status should be 201
    And the nested response "client.name" should equal "Beta Inc"

  Scenario: Fail to create a client without name
    Given a user "bdd-cl@example.com" exists
    When I create a client without name as "bdd-cl@example.com"
    Then the response status should be 400
    And the response body "error" should equal "Validation error"

  Scenario: Fail to create a client without authentication
    When I send an unauthenticated POST to "/api/clients" with name "Unauthed"
    Then the response status should be 401

  Scenario: List all clients for the user
    Given a user "bdd-cl@example.com" exists
    And a client named "ListClient A" exists for "bdd-cl@example.com"
    And a client named "ListClient B" exists for "bdd-cl@example.com"
    When I list clients as "bdd-cl@example.com"
    Then the response status should be 200
    And the nested response "clients" should have at least 2 items

  Scenario: Empty client list for a new user
    Given a user "bdd-cl-empty@example.com" exists
    When I list clients as "bdd-cl-empty@example.com"
    Then the response status should be 200
    And the nested response "clients" should be an empty array

  Scenario: Clients are isolated between users
    Given a user "bdd-cl@example.com" exists
    And a client named "IsolatedCo" exists for "bdd-cl@example.com"
    When I list clients as "bdd-cl-empty@example.com"
    Then the client list should not contain "IsolatedCo"

  Scenario: Get a specific client by ID
    Given a user "bdd-cl@example.com" exists
    And a client named "SpecificCo" exists for "bdd-cl@example.com"
    When I get that client as "bdd-cl@example.com"
    Then the response status should be 200
    And the nested response "client.name" should equal "SpecificCo"

  Scenario: Get non-existent client returns 404
    Given a user "bdd-cl@example.com" exists
    When I get client 99999 as "bdd-cl@example.com"
    Then the response status should be 404

  Scenario: Get client with invalid ID returns 400
    Given a user "bdd-cl@example.com" exists
    When I get client "abc" as "bdd-cl@example.com"
    Then the response status should be 400

  Scenario: Cannot access another user's client
    Given a user "bdd-cl@example.com" exists
    And a client named "PrivateCo" exists for "bdd-cl@example.com"
    When I get that client as "bdd-cl-empty@example.com"
    Then the response status should be 404

  Scenario: Update client fields
    Given a user "bdd-cl@example.com" exists
    And a client named "OldName" exists for "bdd-cl@example.com"
    When I update that client as "bdd-cl@example.com" with name "NewName"
    Then the response status should be 200
    And the response body "message" should equal "Client updated successfully"
    And the nested response "client.name" should equal "NewName"

  Scenario: Update non-existent client returns 404
    Given a user "bdd-cl@example.com" exists
    When I update client 99999 as "bdd-cl@example.com" with name "Ghost"
    Then the response status should be 404

  Scenario: Update client with invalid ID returns 400
    Given a user "bdd-cl@example.com" exists
    When I update client "abc" as "bdd-cl@example.com" with name "Invalid"
    Then the response status should be 400

  Scenario: Update client with empty body returns 400
    Given a user "bdd-cl@example.com" exists
    And a client named "NoUpdateCo" exists for "bdd-cl@example.com"
    When I update that client as "bdd-cl@example.com" with empty body
    Then the response status should be 400

  Scenario: Cannot update another user's client
    Given a user "bdd-cl@example.com" exists
    And a client named "ProtectedCo" exists for "bdd-cl@example.com"
    When I update that client as "bdd-cl-empty@example.com" with name "Hijacked"
    Then the response status should be 404

  Scenario: Delete a specific client
    Given a user "bdd-cl@example.com" exists
    And a client named "ToDeleteCo" exists for "bdd-cl@example.com"
    When I delete that client as "bdd-cl@example.com"
    Then the response status should be 200
    And the response body "message" should equal "Client deleted successfully"
    And that client should no longer exist for "bdd-cl@example.com"

  Scenario: Delete non-existent client returns 404
    Given a user "bdd-cl@example.com" exists
    When I delete client 99999 as "bdd-cl@example.com"
    Then the response status should be 404

  Scenario: Delete client with invalid ID returns 400
    Given a user "bdd-cl@example.com" exists
    When I delete client "abc" as "bdd-cl@example.com"
    Then the response status should be 400

  Scenario: Bulk delete all clients for a user
    Given a user "bdd-bulk@example.com" exists
    And a client named "BulkA" exists for "bdd-bulk@example.com"
    And a client named "BulkB" exists for "bdd-bulk@example.com"
    When I delete all clients as "bdd-bulk@example.com"
    Then the response status should be 200
    And the response body "message" should equal "All clients deleted successfully"
    And the response body "deletedCount" should be number 2
