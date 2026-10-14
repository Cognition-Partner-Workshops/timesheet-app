# JMeter API Test Plan — Timesheet API

## Overview

This JMeter test plan (`timesheet_api_test.jmx`) validates the complete Timesheet API lifecycle with a single user session. It covers authentication, CRUD operations for clients and work entries, report generation (JSON, CSV, PDF), and the health check endpoint.

## Test Scenarios (17 Transactions)

| # | Transaction | Method | Endpoint | Key Assertions |
|---|------------|--------|----------|----------------|
| 01 | AUTH_Login | POST | `/api/auth/login` | 200/201, body contains "successful" |
| 02 | AUTH_GetCurrentUser | GET | `/api/auth/me` | 200, `user.email` matches |
| 03 | CLIENT_CreateClient | POST | `/api/clients` | 201, "Client created successfully" |
| 04 | CLIENT_GetAllClients | GET | `/api/clients` | 200, body contains "clients" |
| 05 | CLIENT_GetClientById | GET | `/api/clients/{id}` | 200, `client.id` matches |
| 06 | CLIENT_UpdateClient | PUT | `/api/clients/{id}` | 200, "Client updated successfully" |
| 07 | WORKENTRY_CreateWorkEntry | POST | `/api/work-entries` | 201, "Work entry created successfully" |
| 08 | WORKENTRY_GetAllWorkEntries | GET | `/api/work-entries` | 200, body contains "workEntries" |
| 09 | WORKENTRY_GetWorkEntriesByClient | GET | `/api/work-entries?clientId={id}` | 200 |
| 10 | WORKENTRY_GetWorkEntryById | GET | `/api/work-entries/{id}` | 200 |
| 11 | WORKENTRY_UpdateWorkEntry | PUT | `/api/work-entries/{id}` | 200, "Work entry updated successfully" |
| 12 | REPORT_GetClientReport | GET | `/api/reports/client/{id}` | 200, body contains "totalHours" |
| 13 | REPORT_ExportCSV | GET | `/api/reports/export/csv/{id}` | 200, CSV content |
| 14 | REPORT_ExportPDF | GET | `/api/reports/export/pdf/{id}` | 200, Content-Type: application/pdf |
| 15 | WORKENTRY_DeleteWorkEntry | DELETE | `/api/work-entries/{id}` | 200, "Work entry deleted successfully" |
| 16 | CLIENT_DeleteClientById | DELETE | `/api/clients/{id}` | 200, "Client deleted successfully" |
| 17 | HEALTH_Check | GET | `/health` | 200, body contains "OK" |

## Prerequisites

- **Java 8+** installed
- **Apache JMeter 5.x** installed ([download](https://jmeter.apache.org/download_jmeter.cgi))
- **Backend running** on `localhost:3001`

## Quick Start

1. **Start the backend:**
   ```bash
   cd backend && npm install && npm start
   ```

2. **Run the test (CLI mode):**
   ```bash
   jmeter -n -t jmeter/timesheet_api_test.jmx -l jmeter/results.jtl -e -o jmeter/report
   ```

3. **View the HTML report:**
   Open `jmeter/report/index.html` in a browser.

## Configuration

User-defined variables in the test plan (override via JMeter properties):

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_EMAIL` | `jmeter-test@example.com` | Test user email |
| `PROTOCOL` | `http` | Protocol |
| `SERVER` | `localhost` | Server hostname |
| `PORT` | `3001` | Server port |

Override at runtime:
```bash
jmeter -n -t jmeter/timesheet_api_test.jmx \
  -JUSER_EMAIL=other@example.com \
  -JSERVER=staging.example.com \
  -JPORT=443 \
  -JPROTOCOL=https \
  -l jmeter/results.jtl -e -o jmeter/report
```

## Notes

- Authentication uses the `x-user-email` header (not JWT).
- The test plan is self-cleaning: it creates and deletes its own test data.
- Thread Group is set to 1 thread / 1 loop for validation; increase for load testing.
