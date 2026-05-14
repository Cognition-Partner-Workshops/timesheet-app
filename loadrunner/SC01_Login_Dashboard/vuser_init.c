/*
 * SC-01: User Login & Dashboard Load
 * vuser_init.c - Virtual User Initialization
 *
 * Application: Time Tracker (Node.js/Express + React/Vite)
 * Protocol: Web HTTP/HTML
 */

vuser_init()
{
    // Log virtual user start
    lr_output_message(">> SC-01: vuser_init started for VUser %s on host %s",
                      lr_eval_string("{vuserid}"),
                      lr_eval_string("{hostname}"));

    // Set global content type for JSON API calls
    web_add_auto_header("Content-Type", "application/json");
    web_add_auto_header("Accept", "application/json");

    // Set maximum HTML parameter length for large JSON responses
    web_set_max_html_param_len("65536");

    // Configure socket options for performance
    web_set_sockets_option("SSL_VERSION", "AUTO");

    lr_output_message(">> SC-01: vuser_init completed successfully.");

    return 0;
}
