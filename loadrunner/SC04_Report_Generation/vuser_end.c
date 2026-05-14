/*
 * SC-04: Report Generation & CSV/PDF Export
 * vuser_end.c - Cleanup: delete test client (cascades to work entries)
 *
 * The backend enforces CASCADE DELETE, so removing the client
 * also removes all associated work entries created in vuser_init.
 */

#include "lrun.h"
#include "web_api.h"

vuser_end()
{
    int http_status = 0;

    lr_log_message(">> SC-04 vuser_end: cleaning up client %s for user %s",
        lr_eval_string("{C_ClientId}"), lr_eval_string("{P_UserEmail}"));

    /* Delete the test client created during init */
    web_add_header("x-user-email", "{P_UserEmail}");

    web_custom_request("DeleteClient",
        "URL=http://localhost:3001/api/clients/{C_ClientId}",
        "Method=DELETE",
        "Resource=0",
        LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);
    if (http_status == 200 || http_status == 204) {
        lr_log_message(">> Cleanup successful: client %s deleted", lr_eval_string("{C_ClientId}"));
    } else {
        lr_output_message(">> Cleanup warning: delete client returned HTTP %d (non-critical)", http_status);
    }

    lr_log_message(">> SC-04 vuser_end completed");

    return 0;
}
