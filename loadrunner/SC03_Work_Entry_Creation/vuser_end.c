/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation
 * File:    vuser_end.c
 * Purpose: Cleanup – delete the client created during vuser_init (cascades
 *          to associated work entries) and log summary information.
 ******************************************************************************/

#include "lrun.h"
#include "web_api.h"

vuser_end()
{
    /* Ensure auth header is set for cleanup requests */
    web_add_header("x-user-email", lr_eval_string("{UserEmail}"));

    /* ------------------------------------------------------------------ *
     *  Delete the perf-test client (cascade-deletes its work entries)     *
     * ------------------------------------------------------------------ */
    web_custom_request("DeleteClient",
        "URL=http://localhost:3001/api/clients/{C_ClientId}",
        "Method=DELETE",
        "Resource=0",
        "EncType=application/json",
        LAST);

    lr_output_message("Cleanup complete – deleted client %s for user %s",
                      lr_eval_string("{C_ClientId}"),
                      lr_eval_string("{UserEmail}"));

    return 0;
}
