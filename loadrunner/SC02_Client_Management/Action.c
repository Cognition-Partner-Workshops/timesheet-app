/*******************************************************************************
 * Script:  SC02_Client_Management - Action
 * Purpose: Client Management - Create & Verify
 *
 * Transactions:
 *   T04_Navigate_Clients  - GET client list
 *   T05_Create_Client     - POST new client
 *   T06_Verify_Client_List - GET client list & verify new client
 *
 * Parameters:
 *   {P_UserEmail}          - User email (params/users.dat)
 *   {P_ClientName}         - Client name (params/clients.dat)
 *   {P_Department}         - Department (params/clients.dat)
 *   {P_ClientEmail}        - Client email (params/clients.dat)
 *   {P_ClientDescription}  - Description (params/clients.dat)
 *
 * Correlations:
 *   {C_ClientId}           - Extracted from POST /api/clients response
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

Action()
{
    int http_status;

    // Ensure auth header is set for this iteration
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * T04_Navigate_Clients - GET /api/clients
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T04_Clients_Count",
                 LAST);

    lr_start_transaction("T04_Navigate_Clients");

    web_custom_request("Navigate_Clients",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T04 FAILED: GET /api/clients returned HTTP %d",
                         http_status);
        lr_end_transaction("T04_Navigate_Clients", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T04_Navigate_Clients", LR_AUTO);

    lr_output_message(">> T04 PASSED: Clients page loaded");

    // Think time: User views client list and decides to add a client
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T05_Create_Client - POST /api/clients
     *------------------------------------------------------------------*/

    // Register correlation to capture the new client ID
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            LAST);

    // Register text check for success message
    web_reg_find("Text=Client created successfully",
                 "SaveCount=T05_Created_Count",
                 LAST);

    lr_start_transaction("T05_Create_Client");

    // Think time embedded: simulates user filling out the form
    lr_think_time(5);

    web_custom_request("Create_Client",
                       "URL=http://localhost:3001/api/clients",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={"
                           "\"name\": \"{P_ClientName}\","
                           "\"department\": \"{P_Department}\","
                           "\"email\": \"{P_ClientEmail}\","
                           "\"description\": \"{P_ClientDescription}\""
                       "}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 201)
    {
        lr_error_message(">> T05 FAILED: POST /api/clients returned HTTP %d. "
                         "Client: %s",
                         http_status,
                         lr_eval_string("{P_ClientName}"));
        lr_end_transaction("T05_Create_Client", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T05_Created_Count}")) < 1)
    {
        lr_error_message(">> T05 FAILED: Success message not found in response");
        lr_end_transaction("T05_Create_Client", LR_FAIL);
        return -1;
    }

    // Validate correlation succeeded
    if (strcmp(lr_eval_string("{C_ClientId}"), "{C_ClientId}") == 0)
    {
        lr_error_message(">> T05 FAILED: Could not correlate C_ClientId");
        lr_end_transaction("T05_Create_Client", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T05_Create_Client", LR_AUTO);

    lr_output_message(">> T05 PASSED: Client '%s' created with ID=%s",
                      lr_eval_string("{P_ClientName}"),
                      lr_eval_string("{C_ClientId}"));

    // Think time: User observes success notification
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T06_Verify_Client_List - GET /api/clients & verify new client
     *------------------------------------------------------------------*/

    // Register text check for the newly created client name
    web_reg_find("Text={P_ClientName}",
                 "SaveCount=T06_ClientFound_Count",
                 LAST);

    lr_start_transaction("T06_Verify_Client_List");

    web_custom_request("Verify_Client_List",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T06 FAILED: Verify GET returned HTTP %d",
                         http_status);
        lr_end_transaction("T06_Verify_Client_List", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T06_ClientFound_Count}")) < 1)
    {
        lr_error_message(">> T06 FAILED: Client '%s' not found in list",
                         lr_eval_string("{P_ClientName}"));
        lr_end_transaction("T06_Verify_Client_List", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T06_Verify_Client_List", LR_AUTO);

    lr_output_message(">> T06 PASSED: Client '%s' verified in list",
                      lr_eval_string("{P_ClientName}"));

    // Think time: User reviews the updated client table
    lr_think_time(3);

    return 0;
}
