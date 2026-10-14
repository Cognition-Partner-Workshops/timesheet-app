/*******************************************************************************
 * Script:  SC05_End_to_End_Flow
 * Purpose: Full E2E business flow performance test
 *          Login → Client → Work Entry → Dashboard → Report → Export
 * Protocol: Web HTTP/HTML
 *
 * Note: Login is part of the E2E flow, so init is minimal
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_init()
{
    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");
    web_set_timeout(30, 60, 120);

    lr_output_message(">> SC05 vuser_init: E2E virtual user %d initialized. "
                      "Email=%s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"));

    return 0;
}
