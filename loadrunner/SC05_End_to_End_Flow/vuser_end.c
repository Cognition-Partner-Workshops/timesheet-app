/*
 * SC-05: End-to-End Business Flow - VUser End / Cleanup
 * Protocol: Web HTTP/HTML
 *
 * Cleans up session state and removes custom headers.
 */

vuser_end()
{
    lr_log_message(">> SC-05 E2E Flow: vuser_end started - cleaning up session");

    // Remove the custom authentication header
    web_add_header("x-user-email", "");
    web_cleanup_custom_headers();

    // Clear any saved correlation parameters
    lr_save_string("", "C_ClientId");
    lr_save_string("", "C_EntryId");

    lr_log_message(">> SC-05 E2E Flow: vuser_end completed for VUser %s",
                   lr_eval_string("{P_UserEmail}"));

    return 0;
}
