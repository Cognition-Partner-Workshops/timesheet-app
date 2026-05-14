/*
 * SC-02: Client Management (Create & Verify)
 * vuser_init.c - Session initialization and authentication
 *
 * Authenticates via POST /api/auth/login using parameterized user email,
 * then sets the x-user-email header for all subsequent requests.
 */

#include "lrun.h"
#include "web_api.h"

vuser_init()
{
    int rc;

    /* Set proxy and connection settings */
    web_set_max_html_param_len("10240");

    lr_log_message(">> vuser_init: Starting session initialization for user: %s",
                   lr_eval_string("{P_UserEmail}"));

    /* Authenticate via POST /api/auth/login */
    web_reg_find("Text=email",
                 "SaveCount=LoginCheck",
                 LAST);

    rc = web_custom_request("Login",
        "URL=http://localhost:3001/api/auth/login",
        "Method=POST",
        "Resource=0",
        "RecContentType=application/json",
        "Mode=HTTP",
        "EncType=application/json",
        "Body={\"email\": \"{P_UserEmail}\"}",
        LAST);

    if (rc != 0) {
        lr_error_message(">> vuser_init: Login request failed with rc=%d", rc);
        lr_abort();
        return -1;
    }

    /* Verify login was successful */
    if (atoi(lr_eval_string("{LoginCheck}")) < 1) {
        lr_error_message(">> vuser_init: Login verification failed - 'email' not found in response");
        lr_abort();
        return -1;
    }

    /* Set x-user-email header for all subsequent requests in this session */
    web_add_auto_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    lr_log_message(">> vuser_init: Authentication successful for user: %s",
                   lr_eval_string("{P_UserEmail}"));

    return 0;
}
