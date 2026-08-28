Feature: Health Check API

  Scenario: Service is healthy
    When I GET "/health"
    Then the status should be 200
    And the response at "status" should be "OK"
    And the response at "timestamp" should exist
