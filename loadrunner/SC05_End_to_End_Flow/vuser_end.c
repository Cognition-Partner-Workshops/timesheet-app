/*******************************************************************************
 * Script:  SC05_End_to_End_Flow - vuser_end
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_end()
{
    lr_output_message(">> SC05 vuser_end: E2E virtual user %d completed. "
                      "Email=%s, ClientId=%s, EntryId=%s, TotalHours=%s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"),
                      lr_eval_string("{C_EntryId}"),
                      lr_eval_string("{C_TotalHours}"));

    return 0;
}
