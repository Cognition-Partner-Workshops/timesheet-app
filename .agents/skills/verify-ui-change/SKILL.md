---
name: verify-ui-change
description: Visually verify a timesheet-app frontend change and attach before/after screenshots to the PR. Use for any UI bug fix or new page.
---

# Verify a UI change

Do this **after** opening the PR — browser verification is slow, and the PR
should not wait on it.

## 1. Capture "before" first

For a bug fix, screenshot the broken state on `main` *before* editing any code.
You cannot recover it afterwards without stashing.

Start the app and seed data with the `run-timesheet-app-locally` skill, then
navigate to the affected route and screenshot the whole window.

## 2. Exercise the change

Vite HMR picks up edits — reload rather than restarting the dev server. The
backend uses in-memory SQLite, so re-seed after any backend restart.

For a new CRUD page, walk the whole loop and screenshot the list afterwards:
create → verify the row → edit (confirm the dialog pre-populates) → confirm the
change in the row → delete → confirm the row is gone. `window.confirm` dialogs
are dismissed with Enter.

Alongside the screenshot you get the page DOM — use it to assert on rendered
text and structure rather than eyeballing pixels. For fine visual detail (a 1px
border through a label, for example) use the `zoom` action; take a fresh full
screenshot for anything sent to the user.

Check `browser_console` for React or network errors before declaring success.

## 3. Attach to the PR

Embed both images with local paths — they are uploaded and rewritten to URLs
automatically:

```markdown
Before | After
--- | ---
![before](/home/ubuntu/screenshots/before_fix.png) | ![after](/home/ubuntu/screenshots/after_fix.png)
```

Send the user full, uncropped screenshots — not zoomed crops.
