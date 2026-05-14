/*
 * SC-02: Client Management (Create & Verify)
 * Action.c - Main test actions
 *
 * Transactions:
 *   T04_Navigate_Clients  - List all clients
 *   T05_Create_Client     - Create a new client via POST
 *   T06_Verify_Client_List - Verify newly created client appears in list
 */

#include "lrun.h"
#include "web_api.h"

Action()
{
    int rc;

    /* ================================================================
     * Transaction T04: Navigate to Clients List
     * ================================================================ */
    lr_start_transaction("T04_Navigate_Clients");

    /* Add x-user-email header for this request */
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /* Register text check for "clients" in response */
    web_reg_find("Text=clients",
                 "SaveCount=NavClientsCheck",
                 LAST);

    rc = web_custom_request("Navigate_Clients",
        "URL=http://localhost:3001/api/clients",
        "Method=GET",
        "Resource=0",
        "RecContentType=application/json",
        "Mode=HTTP",
        LAST);

    if (rc != 0 || atoi(lr_eval_string("{NavClientsCheck}")) < 1) {
        lr_error_message(">> T04_Navigate_Clients: Failed - 'clients' not found in response");
        lr_end_transaction("T04_Navigate_Clients", LR_FAIL);
    } else {
        lr_log_message(">> T04_Navigate_Clients: Successfully retrieved clients list");
        lr_end_transaction("T04_Navigate_Clients", LR_PASS);
    }

    /* Think time: simulate user reviewing the clients list */
    lr_think_time(3);

    /* ================================================================
     * Transaction T05: Create a New Client
     * ================================================================ */
    lr_start_transaction("T05_Create_Client");

    /* Add x-user-email header for this request */
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /* Correlate: extract client ID from response */
    web_reg_save_param_json("ParamName=C_ClientId",
                            "QueryString=$.client.id",
                            "SelectAll=No",
                            "NotFound=WARNING",
                            LAST);

    /* Register text check for success message */
    web_reg_find("Text=Client created successfully",
                 "SaveCount=CreateClientCheck",
                 LAST);

    rc = web_custom_request("Create_Client",
        "URL=http://localhost:3001/api/clients",
        "Method=POST",
        "Resource=0",
        "RecContentType=application/json",
        "Mode=HTTP",
        "EncType=application/json",
        "Body={\"name\": \"{P_ClientName}\", \"department\": \"{P_Department}\", \"email\": \"{P_ClientEmail}\", \"description\": \"{P_ClientDescription}\"}",
        LAST);

    /* Validate correlation and text check */
    if (rc != 0) {
        lr_error_message(">> T05_Create_Client: Request failed with rc=%d", rc);
        lr_end_transaction("T05_Create_Client", LR_FAIL);
    } else if (atoi(lr_eval_string("{CreateClientCheck}")) < 1) {
        lr_error_message(">> T05_Create_Client: Text check failed - 'Client created successfully' not found");
        lr_end_transaction("T05_Create_Client", LR_FAIL);
    } else if (strcmp(lr_eval_string("{C_ClientId}"), "{C_ClientId}") == 0) {
        /* Correlation failed - parameter was not resolved */
        lr_error_message(">> T05_Create_Client: Correlation failed - could not extract client ID from response");
        lr_end_transaction("T05_Create_Client", LR_FAIL);
    } else {
        lr_log_message(">> T05_Create_Client: Client created successfully with ID: %s",
                       lr_eval_string("{C_ClientId}"));
        lr_end_transaction("T05_Create_Client", LR_PASS);
    }

    /* Think time: simulate user filling out the form before submission */
    lr_think_time(5);

    /* ================================================================
     * Transaction T06: Verify Client Appears in List
     * ================================================================ */
    lr_start_transaction("T06_Verify_Client_List");

    /* Add x-user-email header for this request */
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /* Register text check: verify the newly created client name appears */
    web_reg_find("Text={P_ClientName}",
                 "SaveCount=VerifyClientCheck",
                 LAST);

    rc = web_custom_request("Verify_Client_List",
        "URL=http://localhost:3001/api/clients",
        "Method=GET",
        "Resource=0",
        "RecContentType=application/json",
        "Mode=HTTP",
        LAST);

    if (rc != 0 || atoi(lr_eval_string("{VerifyClientCheck}")) < 1) {
        lr_error_message(">> T06_Verify_Client_List: Verification failed - client '%s' not found in list",
                         lr_eval_string("{P_ClientName}"));
        lr_end_transaction("T06_Verify_Client_List", LR_FAIL);
    } else {
        lr_log_message(">> T06_Verify_Client_List: Client '%s' verified in list (ID: %s)",
                       lr_eval_string("{P_ClientName}"),
                       lr_eval_string("{C_ClientId}"));
        lr_end_transaction("T06_Verify_Client_List", LR_PASS);
    }

    /* Think time: simulate user verifying the results */
    lr_think_time(3);

    return 0;
}
