# Custom Subagents Demo — timesheet-app (Devin Desktop / Devin Local)

A ~15-minute walkthrough showing how `.devin/agents/` profiles give you the equivalent of VS Code "custom agents" (backend-worker, frontend-worker, tester, reviewer) inside Devin Desktop's Devin Local agent.

Docs: https://docs.devin.ai/cli/subagents#custom-subagents

---

## 1. Setup Checklist (before the call)

- [ ] Devin Desktop on the latest stable release (**3.8.20+**).
- [ ] **Devin Local** selected as the agent in the Agent Command Center dropdown.
- [ ] **Subagents (Preview)** toggle enabled in Devin Settings (the same capability as `subagents_enabled` in `~/.config/devin/config.json`).
- [ ] `timesheet-app` cloned locally with **this branch checked out** (so `.devin/agents/` exists at the repo root).
- [ ] Dependencies installed: `cd backend && npm install`, `cd frontend && npm install`.
- [ ] Sanity check: `cd backend && npm test` passes (8 suites / 161 tests) and `cd frontend && npm run lint` is clean.
- [ ] Open the repo folder in Devin Desktop and start a fresh Devin Local conversation.

## 2. Opening Talk Track (~2 min)

1. **What they're seeing:** "timesheet-app is a plain Express + SQLite backend with a React 19 + MUI frontend. Nothing Devin-specific — except the `.devin/agents/` folder we added."
2. **The mapping to their world:** "Each markdown file in `.devin/agents/` is a subagent profile — the direct equivalent of your VS Code custom agents in the Agent Control Framework: a name, a description, a pinned model, an allowed-tools list, and a focused system prompt."
3. **Discovery is automatic:** "Devin Local discovers these profiles at session start. The agent sees each profile's description and can pick one itself, or we can name one explicitly in the prompt — which is what we'll do."

Show the four files briefly (each < 40 lines):

| Profile | Purpose | Tools | Model |
|---|---|---|---|
| `backend-worker` | Express/API changes | read, grep, glob, edit, exec | default subagent model |
| `frontend-worker` | React/MUI UI changes | read, grep, glob, edit, exec | default subagent model |
| `tester` | run tests/lint/build, report only | read, grep, glob, exec (**no edit**) | default subagent model |
| `reviewer` | read-only review with file:line findings | read, grep, glob (**no edit, no exec**) | pinned `swe-1-6-fast` (cheap) |

## 3. Scripted Invocations (in order)

### 3.1 backend-worker (~4 min)

**Say:**
> Using the backend-worker subagent, update `workEntrySchema` in `backend/src/validation/schemas.js` so the `date` field rejects future dates, and return the standard 400 validation error.

**Expected behavior:** Devin spawns a subagent with the `backend-worker` profile (visible in the spinner / subagent panel), edits only `backend/src/validation/schemas.js` (a one-line change: `date: Joi.date().iso().max('now').required()`), runs `cd backend && npm test`, and reports back.

**Point at on screen:**
- The spawn step naming the **backend-worker** profile.
- Foreground mode: "Subagent running · Ctrl+B to run in background" — press **Ctrl+B** once to show it continuing in the background, then open the **subagent panel** (↓ then Enter) to show profile, status, elapsed time, and tool-call count.
- The parent summarizing the subagent's result (you never see the subagent's raw transcript).

### 3.2 frontend-worker (~3 min)

**Say:**
> Using the frontend-worker subagent, change the "Add Work Entry" button label in `frontend/src/pages/WorkEntriesPage.tsx` to "Log Work Entry".

**Expected behavior:** the subagent edits only that page, runs `npm run lint` / `npm run build` in `frontend/`, and reports the label change.

**Point at on screen:** the profile name in the spawn call, and that the edit stays inside `frontend/src/` — the system prompt scopes it there.

### 3.3 tester (~2 min)

**Say:**
> Run the backend test suite using the tester subagent and summarize the results.

**Expected behavior:** the subagent runs `cd backend && npm test` and reports "8 suites, 161+ tests passed" (161 before the demo, more if the backend change added tests). It does **not** touch any file.

**Point at on screen:** the profile has no `edit` tool — this is enforced by the runtime, not just the prompt. If the agent tried to edit, the tool simply isn't available. This is the governance story.

### 3.4 reviewer (~3 min)

**Say:**
> Review the uncommitted changes in this repo using the reviewer subagent and report findings with file:line citations.

**Expected behavior:** a read-only subagent (no edit, no exec) pinned to the cheap `swe-1-6-fast` model reviews the two diffs from steps 3.1/3.2 and returns a findings list in `severity — file:line — issue — fix` format.

**Point at on screen:**
- `model: swe-1-6-fast` in the frontmatter — write-capable work stayed on the default model, review runs on a cheaper one. Cost control per agent role.
- The file:line citations in the report.

## 4. Q&A Appendix

**Q: How do these subagents relate to the "custom agents" we built for VS Code / our Agent Control Framework?**
Two complementary layers. (1) *ACP custom agents*: the Agent Command Center dropdown in Devin Desktop can run any ACP-compatible agent side by side with Devin Local, and enterprise admins curate the org-approved list via the admin **ACP Registry Config** — that's the equivalent of registering approved agents in ACF. (2) *Custom subagents* (this demo) are role profiles *inside* one agent: the repo defines backend-worker/frontend-worker/tester/reviewer, and Devin Local orchestrates them within a session.

**Q: How do tool restrictions support a governance framework like ACF?**
`allowed-tools` is enforced by the runtime — the tester literally has no `edit` tool and the reviewer has no `exec`, regardless of what the prompt says. Foreground subagents still go through the normal per-tool-call approval flow; background subagents can only use tools already approved in the session and are auto-denied otherwise. Admins additionally control the **Default subagent model** org setting (pin a model, or set **None** to disable subagents org-wide), and profiles are version-controlled in the repo, so changes go through code review like any other policy artifact.

**Q: Model choice and cost?**
Profiles without `model:` use the default subagent model (SWE-1.6 via the router, admin-overridable). `subagent_general` inherits the parent's (possibly premium) model. Pinning `model:` in a custom profile is the way to run a write-capable worker on a cheaper model.

**Q: Where can profiles live besides the repo?**
`.devin/agents/` or `.agents/agents/` per project, `~/.config/devin/agents/` globally. Claude Code's `.claude/agents/*.md` format is imported automatically (`tools:` is accepted as an alias for `allowed-tools:`).

**Q: Is this GA?**
Custom subagents are currently **experimental** (preview) — the file format and behavior may change in future releases, which is why the Desktop toggle is labeled "Subagents (Preview)".
