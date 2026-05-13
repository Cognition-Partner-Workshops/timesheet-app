/*******************************************************************************
 * Script:  SC04_Report_Generation - Action
 * Purpose: Report Generation & CSV/PDF Export
 *
 * Transactions:
 *   T10_Navigate_Reports  - GET clients list (for dropdown)
 *   T11_Load_Client_Report - GET /api/reports/client/{id}
 *   T12_Export_CSV         - GET /api/reports/export/csv/{id}
 *   T13_Export_PDF         - GET /api/reports/export/pdf/{id}
 *
 * Parameters:
 *   {P_UserEmail}  - User email (params/users.dat)
 *
 * Correlations:
 *   {C_ClientId}    - From vuser_init
 *   {C_TotalHours}  - From report response
 *   {C_EntryCount}  - From report response
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

Action()
{
    int http_status;
    int download_size;

    // Ensure auth header is set
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * T10_Navigate_Reports - GET /api/clients (populates dropdown)
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T10_Clients_Count",
                 LAST);

    lr_start_transaction("T10_Navigate_Reports");

    web_custom_request("Navigate_Reports_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T10 FAILED: GET /api/clients returned HTTP %d",
                         http_status);
        lr_end_transaction("T10_Navigate_Reports", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T10_Navigate_Reports", LR_AUTO);

    lr_output_message(">> T10 PASSED: Reports page loaded with client dropdown");

    // Think time: User selects a client from the dropdown
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T11_Load_Client_Report - GET /api/reports/client/{C_ClientId}
     *------------------------------------------------------------------*/

    // Correlate totalHours and entryCount from response
    web_reg_save_param_json("ParamName=C_TotalHours",
                            "QueryString=$.totalHours",
                            "SelectAll=No",
                            LAST);

    web_reg_save_param_json("ParamName=C_EntryCount",
                            "QueryString=$.entryCount",
                            "SelectAll=No",
                            LAST);

    // Text checks
    web_reg_find("Text=totalHours",
                 "SaveCount=T11_TotalHours_Count",
                 LAST);

    web_reg_find("Text=workEntries",
                 "SaveCount=T11_WorkEntries_Count",
                 LAST);

    lr_start_transaction("T11_Load_Client_Report");

    web_custom_request("Load_Client_Report",
                       "URL=http://localhost:3001/api/reports/client/{C_ClientId}",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T11 FAILED: GET report returned HTTP %d for "
                         "ClientId=%s",
                         http_status,
                         lr_eval_string("{C_ClientId}"));
        lr_end_transaction("T11_Load_Client_Report", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T11_TotalHours_Count}")) < 1 ||
        atoi(lr_eval_string("{T11_WorkEntries_Count}")) < 1)
    {
        lr_error_message(">> T11 FAILED: Report response missing expected fields");
        lr_end_transaction("T11_Load_Client_Report", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T11_Load_Client_Report", LR_AUTO);

    lr_output_message(">> T11 PASSED: Report loaded. TotalHours=%s, "
                      "EntryCount=%s",
                      lr_eval_string("{C_TotalHours}"),
                      lr_eval_string("{C_EntryCount}"));

    // Think time: User reviews the report data
    lr_think_time(5);

    /*------------------------------------------------------------------
     * T12_Export_CSV - GET /api/reports/export/csv/{C_ClientId}
     *------------------------------------------------------------------*/
    lr_start_transaction("T12_Export_CSV");

    web_custom_request("Export_CSV",
                       "URL=http://localhost:3001/api/reports/export/csv/{C_ClientId}",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=text/csv",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    download_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);

    if (http_status != 200)
    {
        lr_error_message(">> T12 FAILED: CSV export returned HTTP %d",
                         http_status);
        lr_end_transaction("T12_Export_CSV", LR_FAIL);
        return -1;
    }

    if (download_size <= 0)
    {
        lr_error_message(">> T12 FAILED: CSV download size is 0 bytes");
        lr_end_transaction("T12_Export_CSV", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T12_Export_CSV", LR_AUTO);

    lr_output_message(">> T12 PASSED: CSV exported. Download size=%d bytes",
                      download_size);

    // Think time: User reviews download
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T13_Export_PDF - GET /api/reports/export/pdf/{C_ClientId}
     *------------------------------------------------------------------*/
    lr_start_transaction("T13_Export_PDF");

    web_custom_request("Export_PDF",
                       "URL=http://localhost:3001/api/reports/export/pdf/{C_ClientId}",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/pdf",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    download_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);

    if (http_status != 200)
    {
        lr_error_message(">> T13 FAILED: PDF export returned HTTP %d",
                         http_status);
        lr_end_transaction("T13_Export_PDF", LR_FAIL);
        return -1;
    }

    if (download_size <= 0)
    {
        lr_error_message(">> T13 FAILED: PDF download size is 0 bytes");
        lr_end_transaction("T13_Export_PDF", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T13_Export_PDF", LR_AUTO);

    lr_output_message(">> T13 PASSED: PDF exported. Download size=%d bytes",
                      download_size);

    lr_think_time(5);

    return 0;
}
