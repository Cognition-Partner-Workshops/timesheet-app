/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation
 * File:    vuser_init.c
 * Purpose: Login via POST /api/auth/login, then create a client to satisfy
 *          the precondition for work-entry creation.  The new client ID is
 *          correlated as {C_ClientId} for use in Action.c.
 ******************************************************************************/

#include "lrun.h"
#include "web_api.h"

vuser_init()
{
    /* ------------------------------------------------------------------ *
     *  Save the parameterized user email for reuse in headers             *
     * ------------------------------------------------------------------ */
    lr_save_string(lr_eval_string("{P_UserEmail}"), "UserEmail");

    /* ------------------------------------------------------------------ *
     *  Add x-user-email header (persists for subsequent requests)         *
     * ------------------------------------------------------------------ */
    web_add_header("x-user-email", lr_eval_string("{UserEmail}"));

    /* ================================================================== *
     *  STEP 1 – Authenticate / auto-provision user                       *
     * ================================================================== */
    web_reg_find("Text=Login successful",  LAST);
    web_reg_find("Text=logged in",         LAST);

    web_custom_request("Login",
        "URL=http://localhost:3001/api/auth/login",
        "Method=POST",
        "Resource=0",
        "EncType=application/json",
        "Body={\"email\":\"{UserEmail}\"}",
        LAST);

    /* Verify login succeeded (HTTP 200 or 201) */
    if (atoi(lr_eval_string("{web_custom_request_return_code}")) < 0) {
        lr_error_message("Login failed for user %s", lr_eval_string("{UserEmail}"));
        return -1;
    }

    lr_output_message("Login successful for user: %s", lr_eval_string("{UserEmail}"));

    /* ================================================================== *
     *  STEP 2 – Create a client (precondition for work entries)          *
     * ================================================================== */

    /* Correlate the new client's id from the JSON response */
    web_reg_save_param_json(
        "ParamName=C_ClientId",
        "QueryString=$.client.id",
        "SelectAll=No",
        LAST);

    web_reg_find("Text=Client created successfully", LAST);

    web_custom_request("CreateClient",
        "URL=http://localhost:3001/api/clients",
        "Method=POST",
        "Resource=0",
        "EncType=application/json",
        "Body={\"name\":\"PerfTest Client {UserEmail}\","
              "\"description\":\"Auto-created client for SC03 perf test\","
              "\"department\":\"Performance Engineering\","
              "\"email\":\"{UserEmail}\"}",
        LAST);

    if (atoi(lr_eval_string("{web_custom_request_return_code}")) < 0) {
        lr_error_message("Client creation failed for user %s",
                         lr_eval_string("{UserEmail}"));
        return -1;
    }

    lr_output_message("Client created with ID: %s",
                      lr_eval_string("{C_ClientId}"));

    return 0;
}
