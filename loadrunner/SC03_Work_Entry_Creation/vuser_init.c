/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation
 * Purpose: Performance test for Work Entry Creation & Verification
 * Protocol: Web HTTP/HTML
 *
 * Pre-condition: Creates a client in init so work entries can be logged
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_init()
{
    int http_status;

    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");
    web_set_timeout(30, 60, 120);

    lr_output_message(">> SC03 vuser_init: Setting up user %s",
                      lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * Step 1: Login
     *------------------------------------------------------------------*/
    web_custom_request("Init_Login",
                       "URL=http://localhost:3001/api/auth/login",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"email\": \"{P_UserEmail}\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200 && http_status != 201)
    {
        lr_error_message(">> Init Login FAILED: HTTP %d", http_status);
        return -1;
    }

    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * Step 2: Create a client (precondition for work entries)
     *------------------------------------------------------------------*/
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            LAST);

    web_reg_find("Text=Client created successfully",
                 "SaveCount=Init_ClientOK_Count",
                 LAST);

    web_custom_request("Init_Create_Client",
                       "URL=http://localhost:3001/api/clients",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"name\": \"PerfTest Client {P_UserEmail}\","
                           "\"department\": \"QA\","
                           "\"description\": \"Auto-created for SC03 perf test\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 201)
    {
        lr_error_message(">> Init Client creation FAILED: HTTP %d", http_status);
        return -1;
    }

    if (strcmp(lr_eval_string("{C_ClientId}"), "{C_ClientId}") == 0)
    {
        lr_error_message(">> Init FAILED: Could not correlate C_ClientId");
        return -1;
    }

    lr_output_message(">> SC03 vuser_init: Setup complete. "
                      "User=%s, ClientId=%s",
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"));

    return 0;
}
