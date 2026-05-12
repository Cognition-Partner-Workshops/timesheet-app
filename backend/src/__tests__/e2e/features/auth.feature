Feature: Authentication API

  Scenario: First-time login creates a new user
    When I login as "bdd-auth@example.com"
    Then the status should be 201
    And the response at "message" should be "User created and logged in successfully"
    And the response at "user.email" should be "bdd-auth@example.com"

  Scenario: Returning user login
    Given a user "bdd-auth@example.com" exists
    When I login as "bdd-auth@example.com"
    Then the status should be 200
    And the response at "message" should be "Login successful"

  Scenario: Login with invalid email format
    When I login with email "not-an-email"
    Then the status should be 400
    And the response at "error" should be "Validation error"

  Scenario: Login with missing email
    When I login with an empty body
    Then the status should be 400
    And the response at "error" should be "Validation error"

  Scenario: Get current user info
    Given a user "bdd-auth@example.com" exists
    When I GET "/api/auth/me" as "bdd-auth@example.com"
    Then the status should be 200
    And the response at "user.email" should be "bdd-auth@example.com"

  Scenario: Get current user without auth header
    When I GET "/api/auth/me"
    Then the status should be 401
    And the response at "error" should be "User email required in x-user-email header"

  Scenario: Get current user with invalid email header
    When I GET "/api/auth/me" as "bad-email"
    Then the status should be 400
    And the response at "error" should be "Invalid email format"

  Scenario: Auth middleware auto-provisions new user
    When I GET "/api/auth/me" as "auto-provision-bdd@example.com"
    Then the status should be 200
    And the response at "user.email" should be "auto-provision-bdd@example.com"
