/*
 * SC-04: Report Generation & CSV/PDF Export
 * vuser_init.c - Setup: login, create client and work entries
 *
 * Precondition: Backend API running at http://localhost:3001
 * Authentication: x-user-email header on all requests
 */

#include "lrun.h"
#include "web_api.h"

vuser_init()
{
    int http_status = 0;
    int i;

    /* ---------- Runtime settings ---------- */
    web_set_max_html_param_len("65536");
    web_set_sockets_option("SSL_VERSION", "AUTO");

    lr_log_message(">> SC-04 vuser_init: starting for user %s", lr_eval_string("{P_UserEmail}"));

    /* ========== STEP 1: Login / auto-provision user ========== */
    web_add_header("Content-Type", "application/json");

    web_custom_request("Login",
        "URL=http://localhost:3001/api/auth/login",
        "Method=POST",
        "Resource=0",
        "Body={\"email\":\"{P_UserEmail}\"}",
        "EncType=application/json",
        LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 200 && http_status != 201) {
        lr_error_message("Login failed with HTTP %d for user %s", http_status, lr_eval_string("{P_UserEmail}"));
        return -1;
    }

    lr_log_message(">> Login successful for %s (HTTP %d)", lr_eval_string("{P_UserEmail}"), http_status);

    /* ========== STEP 2: Create a test client ========== */
    web_add_header("Content-Type", "application/json");
    web_add_header("x-user-email", "{P_UserEmail}");

    /* Correlate the new client ID from the JSON response */
    web_reg_save_param_json(
        "ParamName=C_ClientId",
        "QueryString=$.client.id",
        "SelectAll=No",
        LAST);

    web_custom_request("CreateClient",
        "URL=http://localhost:3001/api/clients",
        "Method=POST",
        "Resource=0",
        "Body={\"name\":\"SC04_PerfClient_{P_UserEmail}\",\"description\":\"Performance test client for report generation\",\"department\":\"QA\",\"email\":\"{P_UserEmail}\"}",
        "EncType=application/json",
        LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status != 201) {
        lr_error_message("Create client failed with HTTP %d", http_status);
        return -1;
    }

    lr_log_message(">> Client created with ID: %s", lr_eval_string("{C_ClientId}"));

    /* ========== STEP 3: Create work entries for the client ========== */
    for (i = 1; i <= 3; i++) {
        char body[512];
        char step_name[64];

        sprintf(step_name, "CreateWorkEntry_%d", i);
        sprintf(body,
            "{\"clientId\":%s,\"hours\":%.1f,\"description\":\"SC04 perf entry %d\",\"date\":\"2025-01-%02d\"}",
            lr_eval_string("{C_ClientId}"),
            (double)(i * 2),
            i,
            10 + i);

        lr_save_string(body, "P_WorkEntryBody");

        web_add_header("Content-Type", "application/json");
        web_add_header("x-user-email", "{P_UserEmail}");

        web_custom_request(step_name,
            "URL=http://localhost:3001/api/work-entries",
            "Method=POST",
            "Resource=0",
            "Body={P_WorkEntryBody}",
            "EncType=application/json",
            LAST);

        http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
        if (http_status != 201) {
            lr_error_message("Create work entry %d failed with HTTP %d", i, http_status);
            return -1;
        }

        lr_log_message(">> Work entry %d created successfully", i);
    }

    lr_log_message(">> SC-04 vuser_init completed: client %s with 3 work entries", lr_eval_string("{C_ClientId}"));

    return 0;
}
