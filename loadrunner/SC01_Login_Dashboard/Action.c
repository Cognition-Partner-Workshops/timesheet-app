/*******************************************************************************
 * Script:  SC01_Login_Dashboard - Action
 * Purpose: User Login & Dashboard Load
 *
 * Transactions:
 *   T01_Launch_App       - Navigate to login page
 *   T02_Login_Submit     - POST login with email
 *   T03_Dashboard_Load   - Load dashboard (clients + work entries)
 *
 * Parameters:
 *   {P_UserEmail}  - Parameterized from params/users.dat
 *
 * Correlations:
 *   None (login response validated but no dynamic IDs needed downstream)
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

Action()
{
    int http_status;

    /*------------------------------------------------------------------
     * T01_Launch_App - Navigate to the login page
     *------------------------------------------------------------------*/

    // Register text check for login page
    web_reg_find("Text=Time Tracker",
                 "SaveCount=T01_TimeTracker_Count",
                 LAST);

    web_reg_find("Text=Email Address",
                 "SaveCount=T01_EmailField_Count",
                 LAST);

    lr_start_transaction("T01_Launch_App");

    web_url("Launch_Login_Page",
            "URL=http://localhost:5173/login",
            "TargetFrame=",
            "Resource=0",
            "RecContentType=text/html",
            "Mode=HTTP",
            LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200 ||
        atoi(lr_eval_string("{T01_TimeTracker_Count}")) < 1)
    {
        lr_error_message(">> T01 FAILED: Login page did not load correctly. "
                         "HTTP=%d, TimeTracker found=%s",
                         http_status,
                         lr_eval_string("{T01_TimeTracker_Count}"));
        lr_end_transaction("T01_Launch_App", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T01_Launch_App", LR_AUTO);

    lr_output_message(">> T01 PASSED: Login page loaded. "
                      "TimeTracker=%s, EmailField=%s",
                      lr_eval_string("{T01_TimeTracker_Count}"),
                      lr_eval_string("{T01_EmailField_Count}"));

    // Think time: User reads the login page
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T02_Login_Submit - POST /api/auth/login
     *------------------------------------------------------------------*/

    // Register text check for successful login
    web_reg_find("Text=Login successful",
                 "SaveCount=T02_LoginSuccess_Count",
                 LAST);

    // Also check for new user creation response
    web_reg_find("Text=User created and logged in successfully",
                 "SaveCount=T02_UserCreated_Count",
                 LAST);

    // Correlate user email from response
    web_reg_save_param_json("ParamName=C_ResponseEmail",
                            "QueryString=$.user.email",
                            "SelectAll=No",
                            LAST);

    lr_start_transaction("T02_Login_Submit");

    web_custom_request("Login_Submit",
                       "URL=http://localhost:3001/api/auth/login",
                       "Method=POST",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"email\": \"{P_UserEmail}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    // Accept both 200 (existing user) and 201 (new user)
    if (http_status != 200 && http_status != 201)
    {
        lr_error_message(">> T02 FAILED: Login returned HTTP %d for email %s",
                         http_status,
                         lr_eval_string("{P_UserEmail}"));
        lr_end_transaction("T02_Login_Submit", LR_FAIL);
        return -1;
    }

    // Verify at least one success message was found
    if (atoi(lr_eval_string("{T02_LoginSuccess_Count}")) < 1 &&
        atoi(lr_eval_string("{T02_UserCreated_Count}")) < 1)
    {
        lr_error_message(">> T02 FAILED: No success message in response");
        lr_end_transaction("T02_Login_Submit", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T02_Login_Submit", LR_AUTO);

    lr_output_message(">> T02 PASSED: Login successful for %s (HTTP %d)",
                      lr_eval_string("{P_UserEmail}"), http_status);

    // Set x-user-email header for all subsequent API calls
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    // Think time: User observes successful login redirect
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T03_Dashboard_Load - GET /api/clients + GET /api/work-entries
     *------------------------------------------------------------------*/

    // Register text checks for clients response
    web_reg_find("Text=clients",
                 "SaveCount=T03_Clients_Count",
                 LAST);

    lr_start_transaction("T03_Dashboard_Load");

    // First API call: Get clients
    web_custom_request("Dashboard_Get_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    // Register text checks for work entries response
    web_reg_find("Text=workEntries",
                 "SaveCount=T03_WorkEntries_Count",
                 LAST);

    // Second API call: Get work entries
    web_custom_request("Dashboard_Get_WorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "TargetFrame=",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T03 FAILED: Dashboard API returned HTTP %d",
                         http_status);
        lr_end_transaction("T03_Dashboard_Load", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T03_Dashboard_Load", LR_AUTO);

    lr_output_message(">> T03 PASSED: Dashboard loaded. "
                      "Clients=%s, WorkEntries=%s",
                      lr_eval_string("{T03_Clients_Count}"),
                      lr_eval_string("{T03_WorkEntries_Count}"));

    // Think time: User reviews dashboard stats
    lr_think_time(5);

    return 0;
}
