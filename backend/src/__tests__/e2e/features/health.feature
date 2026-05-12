Feature: Health Check API

  Scenario: Service is healthy
    When I send a GET request to "/health"
    Then the response status should be 200
    And the response body "status" should equal "OK"
    And the response body "timestamp" should be defined
