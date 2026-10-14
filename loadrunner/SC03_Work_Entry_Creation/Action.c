/*******************************************************************************
 * Script:  SC03_Work_Entry_Creation - Action
 * Purpose: Work Entry Creation & Verification
 *
 * Transactions:
 *   T07_Navigate_WorkEntries - GET work entries list
 *   T08_Create_WorkEntry     - POST new work entry
 *   T09_Verify_WorkEntry_List - GET work entries & verify
 *
 * Parameters:
 *   {P_UserEmail}        - User email (params/users.dat)
 *   {P_Hours}            - Hours worked (params/workentries.dat)
 *   {P_EntryDate}        - Entry date (params/workentries.dat)
 *   {P_WorkDescription}  - Work description (params/workentries.dat)
 *
 * Correlations:
 *   {C_ClientId}  - From vuser_init (client creation)
 *   {C_EntryId}   - Extracted from POST /api/work-entries response
 ******************************************************************************/

#include "web_api.h"
#include "lrun.h"

Action()
{
    int http_status;

    // Ensure auth header is set
    web_add_header("x-user-email", lr_eval_string("{P_UserEmail}"));

    /*------------------------------------------------------------------
     * T07_Navigate_WorkEntries - GET /api/work-entries
     *------------------------------------------------------------------*/
    web_reg_find("Text=workEntries",
                 "SaveCount=T07_Entries_Count",
                 LAST);

    lr_start_transaction("T07_Navigate_WorkEntries");

    web_custom_request("Navigate_WorkEntries",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T07 FAILED: GET /api/work-entries returned HTTP %d",
                         http_status);
        lr_end_transaction("T07_Navigate_WorkEntries", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T07_Navigate_WorkEntries", LR_AUTO);

    lr_output_message(">> T07 PASSED: Work entries page loaded");

    // Think time: User views entries and clicks Add Work Entry
    lr_think_time(3);

    /*------------------------------------------------------------------
     * Fetch clients for dropdown (part of dialog open)
     *------------------------------------------------------------------*/
    web_reg_find("Text=clients",
                 "SaveCount=T07_ClientDropdown_Count",
                 LAST);

    web_custom_request("Fetch_Clients_Dropdown",
                       "URL=http://localhost:3001/api/clients",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    // Think time: User fills in the form fields
    lr_think_time(5);

    /*------------------------------------------------------------------
     * T08_Create_WorkEntry - POST /api/work-entries
     *------------------------------------------------------------------*/

    // Correlate the new work entry ID
    web_reg_save_param_json("ParamName=C_EntryId",
                            "QueryString=$.workEntry.id",
                            "SelectAll=No",
                            LAST);

    // Text check for success
    web_reg_find("Text=Work entry created successfully",
                 "SaveCount=T08_Created_Count",
                 LAST);

    lr_start_transaction("T08_Create_WorkEntry");

    web_custom_request("Create_WorkEntry",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=POST",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       "EncType=application/json",
                       "Body={"
                           "\"clientId\": {C_ClientId},"
                           "\"hours\": {P_Hours},"
                           "\"description\": \"{P_WorkDescription}\","
                           "\"date\": \"{P_EntryDate}\""
                       "}",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 201)
    {
        lr_error_message(">> T08 FAILED: POST /api/work-entries returned HTTP %d. "
                         "ClientId=%s, Hours=%s",
                         http_status,
                         lr_eval_string("{C_ClientId}"),
                         lr_eval_string("{P_Hours}"));
        lr_end_transaction("T08_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T08_Created_Count}")) < 1)
    {
        lr_error_message(">> T08 FAILED: Success message not found");
        lr_end_transaction("T08_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    if (strcmp(lr_eval_string("{C_EntryId}"), "{C_EntryId}") == 0)
    {
        lr_error_message(">> T08 FAILED: Could not correlate C_EntryId");
        lr_end_transaction("T08_Create_WorkEntry", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T08_Create_WorkEntry", LR_AUTO);

    lr_output_message(">> T08 PASSED: Work entry created. ID=%s, "
                      "Hours=%s, Date=%s",
                      lr_eval_string("{C_EntryId}"),
                      lr_eval_string("{P_Hours}"),
                      lr_eval_string("{P_EntryDate}"));

    // Think time: User views success notification
    lr_think_time(3);

    /*------------------------------------------------------------------
     * T09_Verify_WorkEntry_List - GET /api/work-entries & verify
     *------------------------------------------------------------------*/

    // Check that the work description appears in the list
    web_reg_find("Text={P_WorkDescription}",
                 "SaveCount=T09_EntryFound_Count",
                 LAST);

    lr_start_transaction("T09_Verify_WorkEntry_List");

    web_custom_request("Verify_WorkEntry_List",
                       "URL=http://localhost:3001/api/work-entries",
                       "Method=GET",
                       "Resource=0",
                       "RecContentType=application/json",
                       "Mode=HTTP",
                       LAST);

    http_status = web_get_int_property(HTTP_INFO_RETURN_CODE);

    if (http_status != 200)
    {
        lr_error_message(">> T09 FAILED: Verify GET returned HTTP %d",
                         http_status);
        lr_end_transaction("T09_Verify_WorkEntry_List", LR_FAIL);
        return -1;
    }

    if (atoi(lr_eval_string("{T09_EntryFound_Count}")) < 1)
    {
        lr_error_message(">> T09 FAILED: Work entry '%s' not found in list",
                         lr_eval_string("{P_WorkDescription}"));
        lr_end_transaction("T09_Verify_WorkEntry_List", LR_FAIL);
        return -1;
    }

    lr_end_transaction("T09_Verify_WorkEntry_List", LR_AUTO);

    lr_output_message(">> T09 PASSED: Work entry '%s' verified in list",
                      lr_eval_string("{P_WorkDescription}"));

    lr_think_time(3);

    return 0;
}
