Feature: Reports API

  Background:
    Given a user "bdd-rpt@example.com" exists

  # ── JSON Report ─────────────────────────────────────────────────────────────

  Scenario: Get hourly report with totals
    Given a client named "ReportingCo" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 3 hours on "2025-02-01"
    And a work entry exists on that client for "bdd-rpt@example.com" with 5 hours on "2025-02-02"
    When I GET the report for that client as "bdd-rpt@example.com"
    Then the status should be 200
    And the response at "client.name" should be "ReportingCo"
    And the response at "totalHours" should be 8
    And the response at "entryCount" should be 2

  Scenario Outline: Report for bad client ID returns <status>
    When I GET "/api/reports/client/<id>" as "bdd-rpt@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  Scenario: Cannot access another user's report
    Given a client named "PrivateReport" exists for "bdd-rpt@example.com"
    And a user "bdd-rpt-other@example.com" exists
    When I GET the report for that client as "bdd-rpt-other@example.com"
    Then the status should be 404

  # ── CSV Export ──────────────────────────────────────────────────────────────

  Scenario: Export CSV report
    Given a client named "CSVClient" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 4 hours on "2025-02-05"
    When I export CSV for that client as "bdd-rpt@example.com"
    Then the status should be 200
    And the content type should match csv
    And the response text should contain "Date"
    And the response text should contain "Hours"

  Scenario Outline: CSV export for bad client ID returns <status>
    When I export CSV for client "<id>" as "bdd-rpt@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |

  # ── PDF Export ──────────────────────────────────────────────────────────────

  Scenario: Export PDF report
    Given a client named "PDFClient" exists for "bdd-rpt@example.com"
    And a work entry exists on that client for "bdd-rpt@example.com" with 2 hours on "2025-02-06"
    When I export PDF for that client as "bdd-rpt@example.com"
    Then the status should be 200
    And the content type should be "application/pdf"
    And the response should have a PDF attachment header
    And the response body should not be empty

  Scenario Outline: PDF export for bad client ID returns <status>
    When I export PDF for client "<id>" as "bdd-rpt@example.com"
    Then the status should be <status>

    Examples:
      | id    | status |
      | 99999 | 404    |
      | abc   | 400    |
