*** Settings ***
Library           Browser
Library           String
Suite Setup       Open Browser And Set Viewport
Suite Teardown    Close Browser
Test Setup        Reset App State

*** Variables ***
${BASE_URL}           http://localhost:5173
${TEST_EMAIL}         testuser@example.com
${CLIENT_NAME}        Acme Corporation
${CLIENT_DEPT}        Engineering
${CLIENT_EMAIL}       acme@example.com
${CLIENT_DESC}        Test client for E2E testing
${WORK_HOURS}         4
${WORK_DESC}          Developed new feature
${EDITED_HOURS}       6
${EDITED_DESC}        Developed and tested new feature

*** Keywords ***
Open Browser And Set Viewport
    New Browser    chromium    headless=true
    New Context    viewport={'width': 1280, 'height': 900}
    New Page    ${BASE_URL}/login

Reset App State
    Evaluate JavaScript    ${None}    window.localStorage.clear()
    Go To    ${BASE_URL}/login
    Wait For Elements State    h1:has-text("Time Tracker")    visible    timeout=10s

Login With Email
    [Arguments]    ${email}
    Fill Text    input[name="email"]    ${email}
    Click    button:has-text("Log In")
    Wait For Elements State    h4:has-text("Dashboard")    visible    timeout=10s

Navigate To
    [Arguments]    ${page_name}
    Click    nav span:has-text("${page_name}")
    Sleep    1s

Delete All Clients If Any
    Navigate To    Clients
    Sleep    1s
    ${clear_all_visible}=    Get Element Count    button:has-text("Clear All")
    IF    ${clear_all_visible} > 0
        ${dialog_promise}=    Promise To    Wait For Alert    action=accept
        Click    button:has-text("Clear All")
        Wait For    ${dialog_promise}
    END
    Sleep    2s

Create Test Client
    Navigate To    Clients
    Wait For Elements State    h4:has-text("Clients")    visible    timeout=5s
    Click    button:has-text("Add Client")
    Wait For Elements State    [role="dialog"] h2:has-text("Add New Client")    visible    timeout=5s
    Fill Text    [role="dialog"] input >> nth=0    ${CLIENT_NAME}
    Click    [role="dialog"] button:has-text("Create")
    Sleep    2s
    Wait For Elements State    td:has-text("${CLIENT_NAME}")    visible    timeout=10s

Create Test Work Entry
    [Arguments]    ${hours}    ${description}
    Navigate To    Work Entries
    Wait For Elements State    h4:has-text("Work Entries")    visible    timeout=5s
    Click    button:has-text("Add Work Entry")
    Wait For Elements State    [role="dialog"] h2:has-text("Add New Work Entry")    visible    timeout=5s
    # Select client from dropdown
    Click    [role="dialog"] [role="combobox"]
    Sleep    0.5s
    Click    li[role="option"]:has-text("${CLIENT_NAME}")
    Sleep    0.5s
    # Fill hours
    Fill Text    [role="dialog"] input[type="number"]    ${hours}
    # Fill description - use nth=0 to get visible textarea (MUI creates a hidden sizing textarea)
    Fill Text    [role="dialog"] textarea >> nth=0    ${description}
    Click    [role="dialog"] button:has-text("Create")
    Sleep    2s

*** Test Cases ***
01 Login Flow
    [Documentation]    Verify that a user can log in with an email address
    Wait For Elements State    h1:has-text("Time Tracker")    visible
    Wait For Elements State    text=Enter your email to log in    visible
    Wait For Elements State    input[name="email"]    visible
    Get Element States    button:has-text("Log In")    contains    disabled
    Fill Text    input[name="email"]    ${TEST_EMAIL}
    Click    button:has-text("Log In")
    Wait For Elements State    h4:has-text("Dashboard")    visible    timeout=10s
    Wait For Elements State    header >> text=${TEST_EMAIL}    visible    timeout=5s

02 Create A Client
    [Documentation]    Create a new client and verify it appears in the list
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Navigate To    Clients
    Wait For Elements State    h4:has-text("Clients")    visible    timeout=5s
    Click    button:has-text("Add Client")
    Wait For Elements State    [role="dialog"] h2:has-text("Add New Client")    visible    timeout=5s
    Fill Text    [role="dialog"] input >> nth=0    ${CLIENT_NAME}
    Fill Text    [role="dialog"] input >> nth=1    ${CLIENT_DEPT}
    Fill Text    [role="dialog"] input >> nth=2    ${CLIENT_EMAIL}
    Fill Text    [role="dialog"] textarea >> nth=0    ${CLIENT_DESC}
    Click    [role="dialog"] button:has-text("Create")
    Sleep    2s
    Wait For Elements State    td:has-text("${CLIENT_NAME}")    visible    timeout=10s
    Wait For Elements State    td:has-text("${CLIENT_DEPT}")    visible    timeout=5s

03 Create A Work Entry
    [Documentation]    Create a work entry for the client
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Create Test Client
    Create Test Work Entry    ${WORK_HOURS}    ${WORK_DESC}
    Wait For Elements State    td:has-text("${CLIENT_NAME}")    visible    timeout=10s
    Wait For Elements State    text=${WORK_HOURS} hours    visible    timeout=5s

04 Verify Work Entry In List
    [Documentation]    Verify the created work entry appears correctly in the list
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Create Test Client
    Create Test Work Entry    ${WORK_HOURS}    ${WORK_DESC}
    Wait For Elements State    td:has-text("${CLIENT_NAME}")    visible    timeout=10s
    Wait For Elements State    text=${WORK_HOURS} hours    visible    timeout=5s
    Wait For Elements State    td:has-text("${WORK_DESC}")    visible    timeout=5s

05 Edit Work Entry
    [Documentation]    Edit an existing work entry and verify changes
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Create Test Client
    Create Test Work Entry    ${WORK_HOURS}    ${WORK_DESC}
    Wait For Elements State    text=${WORK_HOURS} hours    visible    timeout=10s
    # Click edit on the work entry row
    Click    tr:has-text("${CLIENT_NAME}") >> button:has(svg[data-testid="EditIcon"])
    Wait For Elements State    [role="dialog"] h2:has-text("Edit Work Entry")    visible    timeout=5s
    # Update hours
    Clear Text    [role="dialog"] input[type="number"]
    Fill Text    [role="dialog"] input[type="number"]    ${EDITED_HOURS}
    # Update description
    Clear Text    [role="dialog"] textarea >> nth=0
    Fill Text    [role="dialog"] textarea >> nth=0    ${EDITED_DESC}
    Click    [role="dialog"] button:has-text("Update")
    Sleep    2s
    Wait For Elements State    text=${EDITED_HOURS} hours    visible    timeout=10s
    Wait For Elements State    td:has-text("${EDITED_DESC}")    visible    timeout=5s

06 Delete Work Entry
    [Documentation]    Delete a work entry and verify it's removed
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Create Test Client
    Create Test Work Entry    ${WORK_HOURS}    ${WORK_DESC}
    Wait For Elements State    text=${WORK_HOURS} hours    visible    timeout=10s
    # Delete the entry
    ${dialog_promise}=    Promise To    Wait For Alert    action=accept
    Click    tr:has-text("${CLIENT_NAME}") >> button:has(svg[data-testid="DeleteIcon"])
    Wait For    ${dialog_promise}
    Sleep    2s
    Wait For Elements State    text=No work entries found    visible    timeout=10s

07 Reports Page Shows Correct Totals
    [Documentation]    Verify the reports page shows correct totals for a client
    Login With Email    ${TEST_EMAIL}
    Delete All Clients If Any
    Create Test Client
    Create Test Work Entry    4    First task
    Create Test Work Entry    3    Second task
    Navigate To    Reports
    Wait For Elements State    h4:has-text("Reports")    visible    timeout=5s
    # Select client
    Click    main >> [role="combobox"]
    Sleep    0.5s
    Click    li[role="option"]:has-text("${CLIENT_NAME}")
    Sleep    3s
    # Verify totals: 4 + 3 = 7.00 hours, 2 entries, avg 3.50
    Wait For Elements State    text=Total Hours    visible    timeout=10s
    Wait For Elements State    text=7.00    visible    timeout=5s
    Wait For Elements State    text=Total Entries    visible    timeout=5s
    Wait For Elements State    text=Average Hours per Entry    visible    timeout=5s
    Wait For Elements State    text=3.50    visible    timeout=5s
