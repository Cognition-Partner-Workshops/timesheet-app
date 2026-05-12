Feature: Authentication API

  Scenario: First-time login creates a new user
    When I login with email "bdd-auth@example.com"
    Then the response status should be 201
    And the response body "message" should equal "User created and logged in successfully"
    And the nested response "user.email" should equal "bdd-auth@example.com"

  Scenario: Returning user login
    Given a user "bdd-auth@example.com" exists
    When I login with email "bdd-auth@example.com"
    Then the response status should be 200
    And the response body "message" should equal "Login successful"

  Scenario: Login with invalid email format
    When I login with email "not-an-email"
    Then the response status should be 400
    And the response body "error" should equal "Validation error"

  Scenario: Login with missing email
    When I login with empty body
    Then the response status should be 400
    And the response body "error" should equal "Validation error"

  Scenario: Get current user info
    Given a user "bdd-auth@example.com" exists
    When I get my profile as "bdd-auth@example.com"
    Then the response status should be 200
    And the nested response "user.email" should equal "bdd-auth@example.com"

  Scenario: Get current user without auth header
    When I send a GET request to "/api/auth/me"
    Then the response status should be 401
    And the response body "error" should equal "User email required in x-user-email header"

  Scenario: Get current user with invalid email header
    When I get my profile as "bad-email"
    Then the response status should be 400
    And the response body "error" should equal "Invalid email format"

  Scenario: Auth middleware auto-provisions new user
    When I get my profile as "auto-provision-bdd@example.com"
    Then the response status should be 200
    And the nested response "user.email" should equal "auto-provision-bdd@example.com"
