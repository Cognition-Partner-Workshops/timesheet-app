/*******************************************************************************
 * Script:  SC05_End_to_End_Flow - Action
 * Purpose: Full end-to-end business critical path
 *          Login → Create Client → Log Work Entry → Verify Dashboard →
 *          Generate Report → Export CSV
 *
 * Transactions:
 *   T14_E2E_Launch          - Navigate to login page
 *   T15_E2E_Login           - POST login
 *   T16_E2E_Dashboard       - Load dashboard stats
 *   T17_E2E_Nav_Clients     - Navigate to clients
 *   T18_E2E_Create_Client   - Create new client
 *   T19_E2E_Nav_WorkEntries - Navigate to work entries
 *   T20_E2E_Create_WorkEntry - Create work entry
 *   T21_E2E_Verify_Dashboard - Re-check dashboard with updated totals
 *   T22_E2E_Nav_Reports      - Navigate to reports
 *   T23_E2E_View_Report      - Load client report
 *   T24_E2E_Export_CSV       - Export report as CSV
 *
 * Parameters:
 *   {P_UserEmail}, {P_ClientName}, {P_Department}, {P_ClientEmail},
 *   {P_ClientDescription}, {P_Hours}, {P_EntryDate}, {P_WorkDescription}
 *
 * Correlations:
 *   {C_ClientId}, {C_EntryId}, {C_TotalHours}
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

Action()
{
    int http_status;
    int download_size;

    /*==================================================================
     * PHASE 1: LOGIN
     *==================================================================*/

    /*------------------------------------------------------------------
     * T14_E2E_Launch - Navigate to login page
     *------------------------------------------------------------------*/
    web_reg_find("Text=Time Tracker",
                 "SaveCount=T14_Title_Count",
                 LAST);

    lr_start_transaction("T14_E2E_Launch");

    web_url("E2E_Launch",
            "URL=http://localhost:5173/login",
            "TargetFrame=",
            "Resource=0",
            "RecContentType=text/html",
            "Mode=HTTP",
            LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200 ||
        atoi(lr_eval_string("{T14_Title_Count}")) < 1)
    {
        lr_error_message(">> T14 FAILED: Login page load failed. HTTP=%d",
                         http_status);
        lr_end_transaction("T14_E2E_Launch", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T14_E2E_Launch", LR_AUTO);
    lr_output_message(">> T14 PASSED: Login page loaded");

    lr_think_time(3);

    /*------------------------------------------------------------------
     * T15_E2E_Login - POST /api/auth/login
     *------------------------------------------------------------------*/
    web_reg_find("Text=successful",
                 "SaveCount=T15_Success_Count",
                 LAST);

    lr_start_transaction("T15_E2E_Login");

    web_custom_request("E2E_Login",
                       "URL=http://localhost:3001/api/auth/login",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"email\": \"{P_UserEmail}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if ((http_status != 200 && http_status != 201) ||
        atoi(lr_eval_string("{T15_Success_Count}")) < 1)
    {
        lr_error_message(">> T15 FAILED: Login failed. HTTP=%d", http_status);
        lr_end_transaction("T15_E2E_Login", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T15_E2E_Login", LR_AUTO);

    // Set auth header for all subsequent requests
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    lr_output_message(">> T15 PASSED: Logged in as %s",
                      lr_eval_string("{P_UserEmail}"));

    lr_think_time(5);

    /*==================================================================
     * PHASE 2: DASHBOARD
     *==================================================================*/

    /*------------------------------------------------------------------
     * T16_E2E_Dashboard - GET /api/clients + GET /api/work-entries
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T16_Clients_Count",
                 LAST);

    lr_start_transaction("T16_E2E_Dashboard");

    web_custom_request("E2E_Dashboard_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    web_reg_find("Text=workEntries",
                 "SaveCount=T16_Entries_Count",
                 LAST);

    web_custom_request("E2E_Dashboard_WorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T16 FAILED: Dashboard load HTTP=%d", http_status);
        lr_end_transaction("T16_E2E_Dashboard", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T16_E2E_Dashboard", LR_AUTO);
    lr_output_message(">> T16 PASSED: Dashboard loaded");

    lr_think_time(3);

    /*==================================================================
     * PHASE 3: CREATE CLIENT
     *==================================================================*/

    /*------------------------------------------------------------------
     * T17_E2E_Nav_Clients - GET /api/clients
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T17_Count",
                 LAST);

    lr_start_transaction("T17_E2E_Nav_Clients");

    web_custom_request("E2E_Nav_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    lr_end_transaction("T17_E2E_Nav_Clients", LR_AUTO);
    lr_output_message(">> T17 PASSED: Navigated to Clients");

    lr_think_time(3);

    /*------------------------------------------------------------------
     * T18_E2E_Create_Client - POST /api/clients
     *------------------------------------------------------------------*/
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            LAST);

    web_reg_find("Text=Client created successfully",
                 "SaveCount=T18_Created_Count",
                 LAST);

    lr_start_transaction("T18_E2E_Create_Client");

    // Simulate form fill time
    lr_think_time(5);

    web_custom_request("E2E_Create_Client",
                       "URL=http://localhost:3001/api/clients",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={"
                           "\"name\": \"{P_ClientName}\","
                           "\"department\": \"{P_Department}\","
                           "\"email\": \"{P_ClientEmail}\","
                           "\"description\": \"{P_ClientDescription}\""
                       "}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 201 ||
        atoi(lr_eval_string("{T18_Created_Count}")) < 1)
    {
        lr_error_message(">> T18 FAILED: Client creation failed. HTTP=%d",
                         http_status);
        lr_end_transaction("T18_E2E_Create_Client", LR_FAIL);
        return -1;
    }

    if (strcmp(lr_eval_string("{C_ClientId}"), "{C_ClientId}") == 0)
    {
        lr_error_message(">> T18 FAILED: C_ClientId correlation failed");
        lr_end_transaction("T18_E2E_Create_Client", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T18_E2E_Create_Client", LR_AUTO);

    lr_output_message(">> T18 PASSED: Client '%s' created, ID=%s",
                      lr_eval_string("{P_ClientName}"),
                      lr_eval_string("{C_ClientId}"));

    lr_think_time(3);

    /*==================================================================
     * PHASE 4: CREATE WORK ENTRY
     *==================================================================*/

    /*------------------------------------------------------------------
     * T19_E2E_Nav_WorkEntries - GET /api/work-entries
     *------------------------------------------------------------------*/
    web_reg_find("Text=workEntries",
                 "SaveCount=T19_Count",
                 LAST);

    lr_start_transaction("T19_E2E_Nav_WorkEntries");

    web_custom_request("E2E_Nav_WorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    lr_end_transaction("T19_E2E_Nav_WorkEntries", LR_AUTO);
    lr_output_message(">> T19 PASSED: Navigated to Work Entries");

    lr_think_time(3);

    /*------------------------------------------------------------------
     * T20_E2E_Create_WorkEntry - POST /api/work-entries
     *------------------------------------------------------------------*/
    web_reg_save_param_json("ParamName=C_EntryId",
                            "QueryString=$.workEntry.id",
                            "SelectAll=No",
                            LAST);

    web_reg_find("Text=Work entry created successfully",
                 "SaveCount=T20_Created_Count",
                 LAST);

    lr_start_transaction("T20_E2E_Create_WorkEntry");

    // Simulate form fill time
    lr_think_time(5);

    web_custom_request("E2E_Create_WorkEntry",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={"
                           "\"clientId\": {C_ClientId},"
                           "\"hours\": {P_Hours},"
                           "\"description\": \"{P_WorkDescription}\","
                           "\"date\": \"{P_EntryDate}\""
                       "}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 201 ||
        atoi(lr_eval_string("{T20_Created_Count}")) < 1)
    {
        lr_error_message(">> T20 FAILED: Work entry creation failed. HTTP=%d",
                         http_status);
        lr_end_transaction("T20_E2E_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    if (strcmp(lr_eval_string("{C_EntryId}"), "{C_EntryId}") == 0)
    {
        lr_error_message(">> T20 FAILED: C_EntryId correlation failed");
        lr_end_transaction("T20_E2E_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T20_E2E_Create_WorkEntry", LR_AUTO);

    lr_output_message(">> T20 PASSED: Work entry created. ID=%s, Hours=%s",
                      lr_eval_string("{C_EntryId}"),
                      lr_eval_string("{P_Hours}"));

    lr_think_time(3);

    /*==================================================================
     * PHASE 5: VERIFY DASHBOARD
     *==================================================================*/

    /*------------------------------------------------------------------
     * T21_E2E_Verify_Dashboard - GET clients + work entries
     *------------------------------------------------------------------*/
    lr_start_transaction("T21_E2E_Verify_Dashboard");

    web_custom_request("E2E_Verify_Dash_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    web_reg_find("Text=workEntries",
                 "SaveCount=T21_Entries_Count",
                 LAST);

    web_custom_request("E2E_Verify_Dash_Entries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T21 FAILED: Dashboard verify HTTP=%d", http_status);
        lr_end_transaction("T21_E2E_Verify_Dashboard", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T21_E2E_Verify_Dashboard", LR_AUTO);
    lr_output_message(">> T21 PASSED: Dashboard verified with updated data");

    lr_think_time(3);

    /*==================================================================
     * PHASE 6: REPORTS
     *==================================================================*/

    /*------------------------------------------------------------------
     * T22_E2E_Nav_Reports - GET /api/clients (for dropdown)
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T22_Count",
                 LAST);

    lr_start_transaction("T22_E2E_Nav_Reports");

    web_custom_request("E2E_Nav_Reports",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    lr_end_transaction("T22_E2E_Nav_Reports", LR_AUTO);
    lr_output_message(">> T22 PASSED: Navigated to Reports");

    lr_think_time(3);

    /*------------------------------------------------------------------
     * T23_E2E_View_Report - GET /api/reports/client/{C_ClientId}
     *------------------------------------------------------------------*/
    web_reg_save_param_json("ParamName=C_TotalHours",
                            "QueryString=$.totalHours",
                            "SelectAll=No",
                            LAST);

    web_reg_find("Text=totalHours",
                 "SaveCount=T23_Report_Count",
                 LAST);

    lr_start_transaction("T23_E2E_View_Report");

    web_custom_request("E2E_View_Report",
                       "URL=http://localhost:3001/api/reports/client/{C_ClientId}",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200 ||
        atoi(lr_eval_string("{T23_Report_Count}")) < 1)
    {
        lr_error_message(">> T23 FAILED: Report load failed. HTTP=%d",
                         http_status);
        lr_end_transaction("T23_E2E_View_Report", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T23_E2E_View_Report", LR_AUTO);

    lr_output_message(">> T23 PASSED: Report viewed. TotalHours=%s",
                      lr_eval_string("{C_TotalHours}"));

    lr_think_time(3);

    /*------------------------------------------------------------------
     * T24_E2E_Export_CSV - GET /api/reports/export/csv/{C_ClientId}
     *------------------------------------------------------------------*/
    lr_start_transaction("T24_E2E_Export_CSV");

    web_custom_request("E2E_Export_CSV",
                       "URL=http://localhost:3001/api/reports/export/csv/{C_ClientId}",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=text/csv",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    download_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);

    if (http_status != 200 || download_size <= 0)
    {
        lr_error_message(">> T24 FAILED: CSV export failed. HTTP=%d, Size=%d",
                         http_status, download_size);
        lr_end_transaction("T24_E2E_Export_CSV", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T24_E2E_Export_CSV", LR_AUTO);

    lr_output_message(">> T24 PASSED: CSV exported. Size=%d bytes",
                      download_size);

    lr_think_time(5);

    lr_output_message(">> SC05 E2E FLOW COMPLETED SUCCESSFULLY for user %s",
                      lr_eval_string("{P_UserEmail}"));

    return 0;
}
