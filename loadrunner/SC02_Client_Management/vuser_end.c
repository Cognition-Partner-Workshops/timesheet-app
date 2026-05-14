/*
 * SC-02: Client Management (Create & Verify)
 * vuser_end.c - Session cleanup
 *
 * Performs end-of-session cleanup: removes auto-headers and logs completion.
 */

#include "lrun.h"
#include "web_api.h"

vuser_end()
{
    /* Remove the auto-added x-user-email header */
    web_cleanup_auto_headers();

    lr_log_message(">> vuser_end: Session cleanup complete for user: %s",
                   lr_eval_string("{P_UserEmail}"));

    return 0;
}
