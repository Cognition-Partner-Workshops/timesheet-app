/*******************************************************************************
 * Script:  SC04_Report_Generation
 * Purpose: Performance test for Report Generation & CSV/PDF Export
 * Protocol: Web HTTP/HTML
 *
 * Pre-condition: Creates a client with work entries in init
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_init()
{
    int http_status;
    int i;

    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");
    web_set_timeout(30, 60, 120);

    lr_output_message(">> SC04 vuser_init: Setting up user %s with test data",
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
     * Step 2: Create a client
     *------------------------------------------------------------------*/
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            LAST);

    web_custom_request("Init_Create_Client",
                       "URL=http://localhost:3001/api/clients",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"name\": \"Report Test Client\","
                           "\"department\": \"Analytics\","
                           "\"description\": \"Client for SC04 report testing\"}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 201)
    {
        lr_error_message(">> Init Client FAILED: HTTP %d", http_status);
        return -1;
    }

    if (strcmp(lr_eval_string("{C_ClientId}"), "{C_ClientId}") == 0)
    {
        lr_error_message(">> Init FAILED: Could not correlate C_ClientId");
        return -1;
    }

    lr_output_message(">> Init: Client created with ID=%s",
                      lr_eval_string("{C_ClientId}"));

    /*------------------------------------------------------------------
     * Step 3: Create 3 work entries for the client
     *------------------------------------------------------------------*/
    web_custom_request("Init_WorkEntry_1",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"clientId\": {C_ClientId},"
                           "\"hours\": 8.5,"
                           "\"description\": \"Backend development\","
                           "\"date\": \"2026-05-12\"}",
                       LAST);

    web_custom_request("Init_WorkEntry_2",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"clientId\": {C_ClientId},"
                           "\"hours\": 4.0,"
                           "\"description\": \"Code review\","
                           "\"date\": \"2026-05-11\"}",
                       LAST);

    web_custom_request("Init_WorkEntry_3",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={\"clientId\": {C_ClientId},"
                           "\"hours\": 3.5,"
                           "\"description\": \"Testing\","
                           "\"date\": \"2026-05-10\"}",
                       LAST);

    lr_output_message(">> SC04 vuser_init: Setup complete. "
                      "User=%s, ClientId=%s, 3 work entries created (16.0h total)",
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"));

    return 0;
}
