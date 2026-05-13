/*******************************************************************************
 * Script:  SC02_Client_Management - vuser_end
 * Purpose: Cleanup after Client Management test
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_end()
{
    lr_output_message(">> SC02 vuser_end: Virtual user %d completed. "
                      "Email: %s, Last ClientId: %s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"));

    return 0;
}
