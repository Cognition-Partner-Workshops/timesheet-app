/*
 * SC-05: End-to-End Business Flow
 * Protocol: Web HTTP/HTML
 *
 * Flow: Login -> Client -> Work Entry -> Dashboard -> Report -> Export
 *
 * Transactions:
 *   T14_E2E_Launch           - GET login page
 *   T15_E2E_Login            - POST /api/auth/login
 *   T16_E2E_Dashboard        - GET clients + work entries (initial dashboard)
 *   T17_E2E_Nav_Clients      - GET /api/clients
 *   T18_E2E_Create_Client    - POST /api/clients
 *   T19_E2E_Nav_WorkEntries  - GET /api/work-entries
 *   T20_E2E_Create_WorkEntry - POST /api/work-entries
 *   T21_E2E_Verify_Dashboard - GET clients + work entries (verify)
 *   T22_E2E_Nav_Reports      - GET /api/clients (for report dropdown)
 *   T23_E2E_View_Report      - GET /api/reports/client/{C_ClientId}
 *   T24_E2E_Export_CSV       - GET /api/reports/export/csv/{C_ClientId}
 */

Action()
{
    int http_status  = 0;
    int content_size = 0;

    /* ================================================================
     * T14_E2E_Launch - Navigate to the login page
     * ================================================================ */
    lr_start_transaction("T14_E2E_Launch");

    web_reg_find("Text=Time Tracker",
                 "SaveCount=T14_TextCount",
                 LAST);

    web_url("T14_LaunchApp",
            "URL=http://localhost:5173/",
            "TargetFrame=",
            "Resource=0",
            "RecContentType=text/html",
            "Referer=",
            "Mode=HTML",
            LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T14_E2E_Launch FAILED: HTTP status %d (expected 200)", http_status);
        lr_end_transaction("T14_E2E_Launch", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T14_TextCount}")) < 1) {
        lr_error_message(">> T14_E2E_Launch FAILED: 'Time Tracker' text not found on login page");
        lr_end_transaction("T14_E2E_Launch", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T14_E2E_Launch PASSED: Login page loaded successfully");
    lr_end_transaction("T14_E2E_Launch", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T15_E2E_Login - POST /api/auth/login with parameterized email
     * ================================================================ */
    lr_start_transaction("T15_E2E_Login");

    web_reg_find("Text/IC=successful",
                 "SaveCount=T15_LoginSuccessCount",
                 LAST);

    web_reg_find("Text/IC=created",
                 "SaveCount=T15_UserCreatedCount",
                 LAST);

    web_custom_request("T15_Login",
                       "URL=http://localhost:3001/api/auth/login",
                       "Method=POST",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"email\":\"{P_UserEmail}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200 && http_status != 201) {
        lr_error_message(">> T15_E2E_Login FAILED: HTTP status %d (expected 200 or 201)", http_status);
        lr_end_transaction("T15_E2E_Login", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T15_LoginSuccessCount}")) < 1 &&
        atoi(lr_eval_string("{T15_UserCreatedCount}")) < 1) {
        lr_error_message(">> T15_E2E_Login FAILED: Neither 'Login successful' nor 'User created' found");
        lr_end_transaction("T15_E2E_Login", LR_FAIL);
        return -1;
    }

    // Set authentication header for all subsequent requests
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    lr_log_message(">> T15_E2E_Login PASSED: Authenticated as %s", lr_eval_string("{P_UserEmail}"));
    lr_end_transaction("T15_E2E_Login", LR_PASS);

    lr_think_time(5);

    /* ================================================================
     * T16_E2E_Dashboard - GET /api/clients + GET /api/work-entries
     * ================================================================ */
    lr_start_transaction("T16_E2E_Dashboard");

    // Request 1: Get clients for dashboard
    web_reg_find("Text=clients",
                 "SaveCount=T16_ClientsCount",
                 LAST);

    web_custom_request("T16_GetClients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/dashboard",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T16_E2E_Dashboard FAILED: GET /api/clients returned %d", http_status);
        lr_end_transaction("T16_E2E_Dashboard", LR_FAIL);
        return -1;
    }

    // Request 2: Get work entries for dashboard
    web_reg_find("Text=workEntries",
                 "SaveCount=T16_EntriesCount",
                 LAST);

    web_custom_request("T16_GetWorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/dashboard",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T16_E2E_Dashboard FAILED: GET /api/work-entries returned %d", http_status);
        lr_end_transaction("T16_E2E_Dashboard", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T16_ClientsCount}")) < 1) {
        lr_error_message(">> T16_E2E_Dashboard FAILED: 'clients' keyword not found in response");
        lr_end_transaction("T16_E2E_Dashboard", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T16_EntriesCount}")) < 1) {
        lr_error_message(">> T16_E2E_Dashboard FAILED: 'workEntries' keyword not found in response");
        lr_end_transaction("T16_E2E_Dashboard", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T16_E2E_Dashboard PASSED: Dashboard data loaded successfully");
    lr_end_transaction("T16_E2E_Dashboard", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T17_E2E_Nav_Clients - Navigate to Clients page
     * ================================================================ */
    lr_start_transaction("T17_E2E_Nav_Clients");

    web_reg_find("Text=clients",
                 "SaveCount=T17_ClientsCount",
                 LAST);

    web_custom_request("T17_GetClients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/clients",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T17_E2E_Nav_Clients FAILED: HTTP status %d", http_status);
        lr_end_transaction("T17_E2E_Nav_Clients", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T17_ClientsCount}")) < 1) {
        lr_error_message(">> T17_E2E_Nav_Clients FAILED: 'clients' keyword not found");
        lr_end_transaction("T17_E2E_Nav_Clients", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T17_E2E_Nav_Clients PASSED: Clients page loaded");
    lr_end_transaction("T17_E2E_Nav_Clients", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T18_E2E_Create_Client - POST /api/clients
     * ================================================================ */
    lr_start_transaction("T18_E2E_Create_Client");

    web_reg_find("Text=Client created successfully",
                 "SaveCount=T18_CreateCount",
                 LAST);

    // Correlate the new client ID from JSON response
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            "NotFound=ERROR",
                            LAST);

    web_custom_request("T18_CreateClient",
                       "URL=http://localhost:3001/api/clients",
                       "Method=POST",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/clients",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"name\":\"{P_ClientName}\","
                            "\"department\":\"{P_Department}\","
                            "\"email\":\"{P_ClientEmail}\","
                            "\"description\":\"{P_ClientDescription}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200 && http_status != 201) {
        lr_error_message(">> T18_E2E_Create_Client FAILED: HTTP status %d", http_status);
        lr_end_transaction("T18_E2E_Create_Client", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T18_CreateCount}")) < 1) {
        lr_error_message(">> T18_E2E_Create_Client FAILED: 'Client created successfully' not found");
        lr_end_transaction("T18_E2E_Create_Client", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T18_E2E_Create_Client PASSED: Client created with ID=%s",
                   lr_eval_string("{C_ClientId}"));
    lr_end_transaction("T18_E2E_Create_Client", LR_PASS);

    lr_think_time(5);

    /* ================================================================
     * T19_E2E_Nav_WorkEntries - Navigate to Work Entries page
     * ================================================================ */
    lr_start_transaction("T19_E2E_Nav_WorkEntries");

    web_reg_find("Text=workEntries",
                 "SaveCount=T19_EntriesCount",
                 LAST);

    web_custom_request("T19_GetWorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/work-entries",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T19_E2E_Nav_WorkEntries FAILED: HTTP status %d", http_status);
        lr_end_transaction("T19_E2E_Nav_WorkEntries", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T19_EntriesCount}")) < 1) {
        lr_error_message(">> T19_E2E_Nav_WorkEntries FAILED: 'workEntries' keyword not found");
        lr_end_transaction("T19_E2E_Nav_WorkEntries", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T19_E2E_Nav_WorkEntries PASSED: Work Entries page loaded");
    lr_end_transaction("T19_E2E_Nav_WorkEntries", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T20_E2E_Create_WorkEntry - POST /api/work-entries
     * ================================================================ */
    lr_start_transaction("T20_E2E_Create_WorkEntry");

    web_reg_find("Text=Work entry created successfully",
                 "SaveCount=T20_CreateCount",
                 LAST);

    // Correlate the new work entry ID from JSON response
    web_reg_save_param_json("ParamName=C_EntryId",
                            "QueryString=$.workEntry.id",
                            "SelectAll=No",
                            "NotFound=ERROR",
                            LAST);

    web_custom_request("T20_CreateWorkEntry",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/work-entries",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"clientId\":{C_ClientId},"
                            "\"hours\":{P_Hours},"
                            "\"description\":\"{P_WorkDescription}\","
                            "\"date\":\"{P_EntryDate}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200 && http_status != 201) {
        lr_error_message(">> T20_E2E_Create_WorkEntry FAILED: HTTP status %d", http_status);
        lr_end_transaction("T20_E2E_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T20_CreateCount}")) < 1) {
        lr_error_message(">> T20_E2E_Create_WorkEntry FAILED: 'Work entry created successfully' not found");
        lr_end_transaction("T20_E2E_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T20_E2E_Create_WorkEntry PASSED: Entry ID=%s for Client ID=%s",
                   lr_eval_string("{C_EntryId}"), lr_eval_string("{C_ClientId}"));
    lr_end_transaction("T20_E2E_Create_WorkEntry", LR_PASS);

    lr_think_time(5);

    /* ================================================================
     * T21_E2E_Verify_Dashboard - Verify dashboard reflects new data
     * ================================================================ */
    lr_start_transaction("T21_E2E_Verify_Dashboard");

    // Request 1: Get clients and verify non-empty
    web_reg_save_param_json("ParamName=C_DashClients",
                            "QueryString=$.clients",
                            "SelectAll=No",
                            "NotFound=WARNING",
                            LAST);

    web_custom_request("T21_GetClients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/dashboard",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T21_E2E_Verify_Dashboard FAILED: GET /api/clients returned %d", http_status);
        lr_end_transaction("T21_E2E_Verify_Dashboard", LR_FAIL);
        return -1;
    }

    content_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);
    if (content_size <= 10) {
        lr_error_message(">> T21_E2E_Verify_Dashboard FAILED: Clients response too small (%d bytes)", content_size);
        lr_end_transaction("T21_E2E_Verify_Dashboard", LR_FAIL);
        return -1;
    }

    // Request 2: Get work entries and verify non-empty
    web_reg_save_param_json("ParamName=C_DashEntries",
                            "QueryString=$.workEntries",
                            "SelectAll=No",
                            "NotFound=WARNING",
                            LAST);

    web_custom_request("T21_GetWorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/dashboard",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T21_E2E_Verify_Dashboard FAILED: GET /api/work-entries returned %d", http_status);
        lr_end_transaction("T21_E2E_Verify_Dashboard", LR_FAIL);
        return -1;
    }

    content_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);
    if (content_size <= 10) {
        lr_error_message(">> T21_E2E_Verify_Dashboard FAILED: Work entries response too small (%d bytes)", content_size);
        lr_end_transaction("T21_E2E_Verify_Dashboard", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T21_E2E_Verify_Dashboard PASSED: Dashboard data verified with non-empty responses");
    lr_end_transaction("T21_E2E_Verify_Dashboard", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T22_E2E_Nav_Reports - Navigate to Reports page (load client dropdown)
     * ================================================================ */
    lr_start_transaction("T22_E2E_Nav_Reports");

    web_reg_find("Text=clients",
                 "SaveCount=T22_ClientsCount",
                 LAST);

    web_custom_request("T22_GetClientsForReports",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/reports",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T22_E2E_Nav_Reports FAILED: HTTP status %d", http_status);
        lr_end_transaction("T22_E2E_Nav_Reports", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T22_ClientsCount}")) < 1) {
        lr_error_message(">> T22_E2E_Nav_Reports FAILED: 'clients' keyword not found");
        lr_end_transaction("T22_E2E_Nav_Reports", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T22_E2E_Nav_Reports PASSED: Reports page client dropdown loaded");
    lr_end_transaction("T22_E2E_Nav_Reports", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T23_E2E_View_Report - GET /api/reports/client/{C_ClientId}
     * ================================================================ */
    lr_start_transaction("T23_E2E_View_Report");

    web_reg_find("Text=totalHours",
                 "SaveCount=T23_TotalHoursCount",
                 LAST);

    // Correlate totalHours value from report response
    web_reg_save_param_json("ParamName=C_TotalHours",
                            "QueryString=$.totalHours",
                            "SelectAll=No",
                            "NotFound=WARNING",
                            LAST);

    web_custom_request("T23_ViewReport",
                       "URL=http://localhost:3001/api/reports/client/{C_ClientId}",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Referer=http://localhost:5173/reports",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T23_E2E_View_Report FAILED: HTTP status %d for client %s",
                         http_status, lr_eval_string("{C_ClientId}"));
        lr_end_transaction("T23_E2E_View_Report", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T23_TotalHoursCount}")) < 1) {
        lr_error_message(">> T23_E2E_View_Report FAILED: 'totalHours' not found in report response");
        lr_end_transaction("T23_E2E_View_Report", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T23_E2E_View_Report PASSED: Report loaded for client %s, totalHours=%s",
                   lr_eval_string("{C_ClientId}"), lr_eval_string("{C_TotalHours}"));
    lr_end_transaction("T23_E2E_View_Report", LR_PASS);

    lr_think_time(3);

    /* ================================================================
     * T24_E2E_Export_CSV - GET /api/reports/export/csv/{C_ClientId}
     * ================================================================ */
    lr_start_transaction("T24_E2E_Export_CSV");

    web_custom_request("T24_ExportCSV",
                       "URL=http://localhost:3001/api/reports/export/csv/{C_ClientId}",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=text/csv",
                       "Referer=http://localhost:5173/reports",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200) {
        lr_error_message(">> T24_E2E_Export_CSV FAILED: HTTP status %d for client %s",
                         http_status, lr_eval_string("{C_ClientId}"));
        lr_end_transaction("T24_E2E_Export_CSV", LR_FAIL);
        return -1;
    }

    content_size = web_get_int_property(HTTP_INFO_DOWNLOAD_SIZE);
    if (content_size <= 0) {
        lr_error_message(">> T24_E2E_Export_CSV FAILED: Download size is %d (expected > 0)", content_size);
        lr_end_transaction("T24_E2E_Export_CSV", LR_FAIL);
        return -1;
    }

    lr_log_message(">> T24_E2E_Export_CSV PASSED: CSV exported (%d bytes) for client %s",
                   content_size, lr_eval_string("{C_ClientId}"));
    lr_end_transaction("T24_E2E_Export_CSV", LR_PASS);

    lr_log_message(">> SC-05 End-to-End Flow COMPLETED SUCCESSFULLY for user %s",
                   lr_eval_string("{P_UserEmail}"));

    return 0;
}
