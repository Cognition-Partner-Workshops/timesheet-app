/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation - vuser_end
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

vuser_end()
{
    lr_output_message(">> SC03 vuser_end: Virtual user %d completed. "
                      "Email=%s, ClientId=%s, LastEntryId=%s",
                      lr_whoami(),
                      lr_eval_string("{P_UserEmail}"),
                      lr_eval_string("{C_ClientId}"),
                      lr_eval_string("{C_EntryId}"));

    return 0;
}
