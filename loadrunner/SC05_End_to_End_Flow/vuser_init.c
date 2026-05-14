/*
 * SC-05: End-to-End Business Flow - VUser Initialization
 * Protocol: Web HTTP/HTML
 * 
 * Minimal init since login is part of the E2E flow in Action.c
 */

vuser_init()
{
    // Log virtual user initialization
    lr_log_message(">> SC-05 E2E Flow: vuser_init started for VUser %s",
                   lr_eval_string("{P_UserEmail}"));

    // Set default web configuration
    web_set_max_html_param_len("65536");

    // Enable content checks globally
    web_set_sockets_option("SSL_VERSION", "AUTO");

    lr_log_message(">> SC-05 E2E Flow: vuser_init completed successfully");

    return 0;
}
