/*******************************************************************************
 * Script:  SC02_Client_Management
 * Purpose: Performance test for Client Management (Create & Verify)
 * Protocol: Web HTTP/HTML
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_init()
{
    int http_status;

    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");
    web_set_timeout(30, 60, 120);

    lr_output_message(">> SC02 vuser_init: Logging in as %s",
                      lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * Pre-condition: Login to establish authenticated session
     *------------------------------------------------------------------*/
    web_reg_find("Text=successful",
                 "SaveCount=Init_LoginOK_Count",
                 LAST);

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
        lr_error_message(">> Init FAILED: Login returned HTTP %d", http_status);
        return -1;
    }

    // Set auth header for all subsequent requests
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    lr_output_message(">> SC02 vuser_init: Login successful for %s",
                      lr_eval_string("{P_UserEmail}"));

    return 0;
}
