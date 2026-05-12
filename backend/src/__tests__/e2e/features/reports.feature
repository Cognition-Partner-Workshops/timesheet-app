Feature: Reports API

  Scenario: Get hourly report with totals
    Given a user "bdd-rpt@example.com" exists
    And a client named "ReportingCo" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 3 hours on "2025-02-01"
    And a work entry exists on that client for "bdd-rpt@example.com" with 5 hours on "2025-02-02"
    When I get the report for that client as "bdd-rpt@example.com"
    Then the response status should be 200
    And the nested response "client.name" should equal "ReportingCo"
    And the nested response "totalHours" should be number 8
    And the nested response "entryCount" should be number 2

  Scenario: Report for non-existent client returns 404
    Given a user "bdd-rpt@example.com" exists
    When I get the report for client 99999 as "bdd-rpt@example.com"
    Then the response status should be 404

  Scenario: Report with invalid client ID returns 400
    Given a user "bdd-rpt@example.com" exists
    When I get the report for client "abc" as "bdd-rpt@example.com"
    Then the response status should be 400

  Scenario: Cannot access another user's report
    Given a user "bdd-rpt@example.com" exists
    And a client named "PrivateReport" exists for "bdd-rpt@example.com"
    And a user "bdd-rpt-other@example.com" exists
    When I get the report for that client as "bdd-rpt-other@example.com"
    Then the response status should be 404

  Scenario: Export CSV report
    Given a user "bdd-rpt@example.com" exists
    And a client named "CSVClient" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 4 hours on "2025-02-05"
    When I export CSV for that client as "bdd-rpt@example.com"
    Then the response status should be 200
    And the response content type should match csv
    And the response text should contain "Date"
    And the response text should contain "Hours"

  Scenario: CSV export for non-existent client returns 404
    Given a user "bdd-rpt@example.com" exists
    When I export CSV for client 99999 as "bdd-rpt@example.com"
    Then the response status should be 404

  Scenario: CSV export with invalid client ID returns 400
    Given a user "bdd-rpt@example.com" exists
    When I export CSV for client "abc" as "bdd-rpt@example.com"
    Then the response status should be 400

  Scenario: Export PDF report
    Given a user "bdd-rpt@example.com" exists
    And a client named "PDFClient" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 2 hours on "2025-02-06"
    When I export PDF for that client as "bdd-rpt@example.com"
    Then the response status should be 200
    And the response content type should be "application/pdf"
    And the response should have a PDF attachment header
    And the response body should not be empty

  Scenario: PDF export for non-existent client returns 404
    Given a user "bdd-rpt@example.com" exists
    When I export PDF for client 99999 as "bdd-rpt@example.com"
    Then the response status should be 404

  Scenario: PDF export with invalid client ID returns 400
    Given a user "bdd-rpt@example.com" exists
    When I export PDF for client "abc" as "bdd-rpt@example.com"
    Then the response status should be 400
