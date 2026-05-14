/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation
 * File:    Action.c
 * Purpose: Main iteration – navigate to work entries, fetch the client
 *          dropdown, create a new work entry, then verify it appears in
 *          the list.
 *
 * Parameters used:
 *   {C_ClientId}       – correlated in vuser_init (client id)
 *   {P_Hours}          – from params/workentries.dat
 *   {P_WorkDescription}– from params/workentries.dat
 *   {P_EntryDate}      – from params/workentries.dat
 *   {UserEmail}        – saved in vuser_init
 ******************************************************************************/

#include "lrun.h"
#include "web_api.h"

Action()
{
    int  rc = LR_PASS;
    char *clientListBody = NULL;

    /* Ensure the auth header is present for every iteration */
    web_add_header("x-user-email", lr_eval_string("{UserEmail}"));

    /* ================================================================== *
     *  T07 – Navigate to Work Entries page                               *
     * ================================================================== */
    lr_start_transaction("T07_Navigate_WorkEntries");

    web_reg_find("Text=workEntries",
                 "SaveCount=T07_FindCount",
                 LAST);

    web_custom_request("GetWorkEntries",
        "URL=http://localhost:3001/api/work-entries",
        "Method=GET",
        "Resource=0",
        "EncType=application/json",
        LAST);

    if (atoi(lr_eval_string("{T07_FindCount}")) < 1) {
        lr_error_message("T07: 'workEntries' key not found in response");
        rc = LR_FAIL;
    }

    lr_end_transaction("T07_Navigate_WorkEntries", rc);

    /* Think time – user reviews the work-entries list */
    lr_think_time(3);

    /* ================================================================== *
     *  Fetch clients for dropdown (implicit step)                        *
     * ================================================================== */
    rc = LR_PASS;

    web_reg_find("Text=clients",
                 "SaveCount=ClientsKeyCount",
                 LAST);

    /* Save entire response body so we can verify our client id exists */
    web_reg_save_param_json(
        "ParamName=C_ClientList",
        "QueryString=$.clients[*].id",
        "SelectAll=Yes",
        LAST);

    web_custom_request("GetClientsDropdown",
        "URL=http://localhost:3001/api/clients",
        "Method=GET",
        "Resource=0",
        "EncType=application/json",
        LAST);

    if (atoi(lr_eval_string("{ClientsKeyCount}")) < 1) {
        lr_error_message("Clients dropdown: 'clients' key not found");
    }

    /* Verify our correlated client id is present in the list */
    if (strstr(lr_eval_string("{C_ClientList}"),
               lr_eval_string("{C_ClientId}")) == NULL) {
        lr_error_message("Client ID %s not found in clients dropdown",
                         lr_eval_string("{C_ClientId}"));
    } else {
        lr_output_message("Client ID %s confirmed in dropdown",
                          lr_eval_string("{C_ClientId}"));
    }

    /* Think time – user selects client and fills in form fields */
    lr_think_time(5);

    /* ================================================================== *
     *  T08 – Create Work Entry                                           *
     * ================================================================== */
    rc = LR_PASS;

    lr_start_transaction("T08_Create_WorkEntry");

    /* Correlate the new work-entry id from the response */
    web_reg_save_param_json(
        "ParamName=C_EntryId",
        "QueryString=$.workEntry.id",
        "SelectAll=No",
        LAST);

    web_reg_find("Text=Work entry created successfully",
                 "SaveCount=T08_FindCount",
                 LAST);

    web_custom_request("CreateWorkEntry",
        "URL=http://localhost:3001/api/work-entries",
        "Method=POST",
        "Resource=0",
        "EncType=application/json",
        "Body={\"clientId\":{C_ClientId},"
              "\"hours\":{P_Hours},"
              "\"description\":\"{P_WorkDescription}\","
              "\"date\":\"{P_EntryDate}\"}",
        LAST);

    if (atoi(lr_eval_string("{T08_FindCount}")) < 1) {
        lr_error_message("T08: 'Work entry created successfully' not found");
        rc = LR_FAIL;
    } else {
        lr_output_message("T08: Work entry created – ID %s, Hours %s, Date %s",
                          lr_eval_string("{C_EntryId}"),
                          lr_eval_string("{P_Hours}"),
                          lr_eval_string("{P_EntryDate}"));
    }

    lr_end_transaction("T08_Create_WorkEntry", rc);

    /* Think time – user reviews confirmation before navigating */
    lr_think_time(5);

    /* ================================================================== *
     *  T09 – Verify Work Entry appears in List                           *
     * ================================================================== */
    rc = LR_PASS;

    lr_start_transaction("T09_Verify_WorkEntry_List");

    /* Check that the description we just submitted appears in the list */
    web_reg_find("Text={P_WorkDescription}",
                 "SaveCount=T09_FindCount",
                 LAST);

    web_custom_request("VerifyWorkEntryList",
        "URL=http://localhost:3001/api/work-entries",
        "Method=GET",
        "Resource=0",
        "EncType=application/json",
        LAST);

    if (atoi(lr_eval_string("{T09_FindCount}")) < 1) {
        lr_error_message("T09: Work description '%s' not found in entries list",
                         lr_eval_string("{P_WorkDescription}"));
        rc = LR_FAIL;
    } else {
        lr_output_message("T09: Verified – description '%s' found in work entries",
                          lr_eval_string("{P_WorkDescription}"));
    }

    lr_end_transaction("T09_Verify_WorkEntry_List", rc);

    /* Think time – user reviews the updated list */
    lr_think_time(3);

    return 0;
}
