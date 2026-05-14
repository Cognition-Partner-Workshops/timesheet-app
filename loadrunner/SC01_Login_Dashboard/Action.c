/*
 * SC-01: User Login & Dashboard Load
 * Action.c - Main Test Script
 *
 * Transactions:
 *   T01_Launch_App      - GET login page
 *   T02_Login_Submit     - POST /api/auth/login
 *   T03_Dashboard_Load   - GET /api/clients & GET /api/work-entries
 *
 * Application: Time Tracker (Node.js/Express + React/Vite)
 * Protocol: Web HTTP/HTML
 */

Action()
{
    int http_status;

    /*=======================================================================
     * T01_Launch_App - Navigate to the login page
     *=======================================================================*/

    // Register text check for login page
    web_reg_find("Text=Time Tracker",
                 "SaveCount=T01_TextCheck",
                 LAST);

    lr_start_transaction("T01_Launch_App");

    web_url("Launch_Login_Page",
            "URL=http://localhost:5173/login",
            "TargetFrame=",
            "Resource=0",
            "RecContentType=text/html",
            "Referer=",
            "Mode=HTML",
            LAST);

    // Validate T01 text check
    http_status = atoi(lr_eval_string("{T01_TextCheck}"));
    if (http_status < 1) {
        lr_error_message(">> T01_Launch_App FAILED: 'Time Tracker' text not found on login page.");
        lr_end_transaction("T01_Launch_App", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T01_Launch_App", LR_AUTO);
    lr_output_message(">> T01_Launch_App completed successfully.");

    // Think time between launch and login
    lr_think_time(3);

    /*=======================================================================
     * T02_Login_Submit - POST login request with email
     *=======================================================================*/

    // Register text check for login response
    web_reg_find("Text/IC=email",
                 "SaveCount=T02_TextCheck",
                 LAST);

    // Correlate user email from JSON response
    web_reg_save_param_json("ParamName=CorrelatedEmail",
                            "QueryString=$.user.email",
                            "SelectAll=No",
                            "NotFound=ERROR",
                            LAST);

    lr_start_transaction("T02_Login_Submit");

    web_custom_request("Login_Submit",
                       "URL=http://localhost:3001/api/auth/login",
                       "Method=POST",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Body={\"email\": \"{P_UserEmail}\"}",
                       LAST);

    // Validate T02 text check
    http_status = atoi(lr_eval_string("{T02_TextCheck}"));
    if (http_status < 1) {
        lr_error_message(">> T02_Login_Submit FAILED: Expected 'email' in login response. User: %s",
                         lr_eval_string("{P_UserEmail}"));
        lr_end_transaction("T02_Login_Submit", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T02_Login_Submit", LR_AUTO);
    lr_output_message(">> T02_Login_Submit completed successfully. Logged in as: %s",
                      lr_eval_string("{CorrelatedEmail}"));

    // Add x-user-email header for all subsequent authenticated requests
    web_add_header("x-user-email", lr_eval_string("{CorrelatedEmail}"));

    /*=======================================================================
     * T03_Dashboard_Load - Load dashboard data (clients + work entries)
     *=======================================================================*/

    // Register text checks for clients response
    web_reg_find("Text=clients",
                 "SaveCount=T03_ClientsCheck",
                 LAST);

    // Register text checks for work entries response
    web_reg_find("Text=workEntries",
                 "SaveCount=T03_WorkEntriesCheck",
                 LAST);

    lr_start_transaction("T03_Dashboard_Load");

    // Request 1: GET /api/clients
    web_custom_request("Get_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       LAST);

    // Validate clients response
    http_status = atoi(lr_eval_string("{T03_ClientsCheck}"));
    if (http_status < 1) {
        lr_error_message(">> T03_Dashboard_Load FAILED: 'clients' not found in GET /api/clients response.");
        lr_end_transaction("T03_Dashboard_Load", LR_FAIL);
        return -1;
    }

    // Request 2: GET /api/work-entries
    web_custom_request("Get_Work_Entries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       LAST);

    // Validate work entries response
    http_status = atoi(lr_eval_string("{T03_WorkEntriesCheck}"));
    if (http_status < 1) {
        lr_error_message(">> T03_Dashboard_Load FAILED: 'workEntries' not found in GET /api/work-entries response.");
        lr_end_transaction("T03_Dashboard_Load", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T03_Dashboard_Load", LR_AUTO);
    lr_output_message(">> T03_Dashboard_Load completed successfully. Dashboard loaded for user: %s",
                      lr_eval_string("{CorrelatedEmail}"));

    // Think time after dashboard load
    lr_think_time(5);

    return 0;
}
