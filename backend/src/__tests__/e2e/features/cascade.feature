Feature: Cascade Delete and Route Handling

  Scenario: Deleting a client cascades to its work entries
    Given a user "bdd-cascade@example.com" exists
    And a client named "CascadeClient" exists for "bdd-cascade@example.com"
    And a work entry exists on that client for "bdd-cascade@example.com" with 2 hours on "2025-03-01"
    When I delete that client as "bdd-cascade@example.com"
    Then the response status should be 200
    And user "bdd-cascade@example.com" should have 0 work entries

  Scenario: Unknown route returns 404
    When I send a GET request to "/api/nonexistent"
    Then the response status should be 404
    And the response body "error" should equal "Route not found"
