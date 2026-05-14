/*
 * SC-04: Report Generation & CSV/PDF Export
 * Action.c - Main iteration script
 *
 * Transactions:
 *   T10_Navigate_Reports      - Fetch client list for the reports dropdown
 *   T11_Load_Client_Report    - Load full client report with hours & entries
 *   T12_Export_CSV             - Export report as CSV file download
 *   T13_Export_PDF             - Export report as PDF file download
 */

#include "lrun.h"
#include "web_api.h"

Action()
{
    int http_status  = 0;
    int download_size = 0;

    /* ==================================================================
     * T10 - Navigate to Reports page (load client list for dropdown)
     * ================================================================== */
    lr_start_transaction("T10_Navigate_Reports");

    web_add_header("x-user-email", "{P_UserEmail}");

    web_reg_find("Text=clients",
        "SaveCount=T10_ClientsFound",
        LAST);

    web_custom_request("GetClients",
        "URL=http://localhost:3001/api/clients",
        "Method=GET",
        "Resource=0",
        LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message("T10: GET /api/clients failed with HTTP %d", http_status);
        lr_end_transaction("T10_Navigate_Reports", LR_FAIL);
    } else if (atoi(lr_eval_string("{T10_ClientsFound}")) < 1) {
        lr_error_message("T10: Text check failed - 'clients' not found in response");
        lr_end_transaction("T10_Navigate_Reports", LR_FAIL);
    } else {
        lr_log_message(">> T10: Client list loaded successfully");
        lr_end_transaction("T10_Navigate_Reports", LR_PASS);
    }

    lr_think_time(3);

    /* ==================================================================
     * T11 - Load Client Report
     * ================================================================== */
    lr_start_transaction("T11_Load_Client_Report");

    web_add_header("x-user-email", "{P_UserEmail}");

    /* Text checks for expected response keys */
    web_reg_find("Text=totalHours",
        "SaveCount=T11_TotalHoursFound",
        LAST);

    web_reg_find("Text=workEntries",
        "SaveCount=T11_WorkEntriesFound",
        LAST);

    /* Correlate totalHours and entryCount from JSON response */
    web_reg_save_param_json(
        "ParamName=C_TotalHours",
        "QueryString=$.totalHours",
        "SelectAll=No",
        LAST);

    web_reg_save_param_json(
        "ParamName=C_EntryCount",
        "QueryString=$.entryCount",
        "SelectAll=No",
        LAST);

    web_custom_request("LoadClientReport",
        "URL=http://localhost:3001/api/reports/client/{C_ClientId}",
        "Method=GET",
        "Resource=0",
        LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message("T11: GET /api/reports/client/%s failed with HTTP %d",
            lr_eval_string("{C_ClientId}"), http_status);
        lr_end_transaction("T11_Load_Client_Report", LR_FAIL);
    } else if (atoi(lr_eval_string("{T11_TotalHoursFound}")) < 1 ||
               atoi(lr_eval_string("{T11_WorkEntriesFound}")) < 1) {
        lr_error_message("T11: Text check failed - 'totalHours' or 'workEntries' not found");
        lr_end_transaction("T11_Load_Client_Report", LR_FAIL);
    } else {
        lr_log_message(">> T11: Client report loaded - totalHours=%s, entryCount=%s",
            lr_eval_string("{C_TotalHours}"), lr_eval_string("{C_EntryCount}"));
        lr_end_transaction("T11_Load_Client_Report", LR_PASS);
    }

    lr_think_time(5);

    /* ==================================================================
     * T12 - Export CSV
     * ================================================================== */
    lr_start_transaction("T12_Export_CSV");

    web_add_header("x-user-email", "{P_UserEmail}");

    /* Save Content-Type header to verify CSV */
    web_save_header(RESPONSE, "AllHeaders_CSV");

    web_custom_request("ExportCSV",
        "URL=http://localhost:3001/api/reports/export/csv/{C_ClientId}",
        "Method=GET",
        "Resource=0",
        LAST);

    http_status   = web_get_int_property(HTTP_INFO_RETURN_CODE);
    download_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);

    if (http_status != 200) {
        lr_error_message("T12: CSV export failed with HTTP %d", http_status);
        lr_end_transaction("T12_Export_CSV", LR_FAIL);
    } else if (download_size <= 0) {
        lr_error_message("T12: CSV export returned empty response (size=%d)", download_size);
        lr_end_transaction("T12_Export_CSV", LR_FAIL);
    } else if (strstr(lr_eval_string("{AllHeaders_CSV}"), "csv") == NULL) {
        lr_error_message("T12: Content-Type does not contain 'csv'");
        lr_end_transaction("T12_Export_CSV", LR_FAIL);
    } else {
        lr_log_message(">> T12: CSV exported successfully, size=%d bytes", download_size);
        lr_end_transaction("T12_Export_CSV", LR_PASS);
    }

    lr_think_time(3);

    /* ==================================================================
     * T13 - Export PDF
     * ================================================================== */
    lr_start_transaction("T13_Export_PDF");

    web_add_header("x-user-email", "{P_UserEmail}");

    /* Save Content-Type header to verify PDF */
    web_save_header(RESPONSE, "AllHeaders_PDF");

    web_custom_request("ExportPDF",
        "URL=http://localhost:3001/api/reports/export/pdf/{C_ClientId}",
        "Method=GET",
        "Resource=0",
        LAST);

    http_status   = web_get_int_property(HTTP_INFO_RETURN_CODE);
    download_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);

    if (http_status != 200) {
        lr_error_message("T13: PDF export failed with HTTP %d", http_status);
        lr_end_transaction("T13_Export_PDF", LR_FAIL);
    } else if (download_size <= 0) {
        lr_error_message("T13: PDF export returned empty response (size=%d)", download_size);
        lr_end_transaction("T13_Export_PDF", LR_FAIL);
    } else if (strstr(lr_eval_string("{AllHeaders_PDF}"), "pdf") == NULL) {
        lr_error_message("T13: Content-Type does not contain 'pdf'");
        lr_end_transaction("T13_Export_PDF", LR_FAIL);
    } else {
        lr_log_message(">> T13: PDF exported successfully, size=%d bytes", download_size);
        lr_end_transaction("T13_Export_PDF", LR_PASS);
    }

    return 0;
}
