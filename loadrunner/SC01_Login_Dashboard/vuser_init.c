/*******************************************************************************
 * Script:  SC01_Login_Dashboard
 * Purpose: Performance test for User Login & Dashboard Load
 * Protocol: Web HTTP/HTML
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_init()
{
    // Set content type for JSON API calls
    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");

    // Set proxy and timeout settings
    web_set_timeout(30, 60, 120);

    lr_output_message(">> SC01 vuser_init: Virtual user %d initialized",
                      lr_whoami());

    return 0;
}
