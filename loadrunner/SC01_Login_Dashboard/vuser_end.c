/*******************************************************************************
 * Script:  SC01_Login_Dashboard - vuser_end
 * Purpose: Cleanup after Login & Dashboard test
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_end()
{
    lr_output_message(">> SC01 vuser_end: Virtual user %d completed. "
                      "Email: %s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"));

    return 0;
}
