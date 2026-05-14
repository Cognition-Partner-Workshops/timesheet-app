/*
 * SC-01: User Login & Dashboard Load
 * vuser_end.c - Virtual User Cleanup
 *
 * Application: Time Tracker (Node.js/Express + React/Vite)
 * Protocol: Web HTTP/HTML
 */

vuser_end()
{
    // Log virtual user completion
    lr_output_message(">> SC-01: vuser_end started for VUser %s.",
                      lr_eval_string("{vuserid}"));

    // Clear custom headers set during the session
    web_cleanup_auto_headers();

    // Remove the x-user-email header
    web_revert_auto_header("Content-Type");
    web_revert_auto_header("Accept");

    lr_output_message(">> SC-01: vuser_end completed. Virtual user session cleaned up.");

    return 0;
}
