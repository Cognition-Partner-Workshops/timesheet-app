/*******************************************************************************
 * Script:  SC04_Report_Generation - vuser_end
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_end()
{
    lr_output_message(">> SC04 vuser_end: Virtual user %d completed. "
                      "Email=%s, ClientId=%s, TotalHours=%s, EntryCount=%s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"),
                      lr_eval_string("{C_TotalHours}"),
                      lr_eval_string("{C_EntryCount}"));

    return 0;
}
