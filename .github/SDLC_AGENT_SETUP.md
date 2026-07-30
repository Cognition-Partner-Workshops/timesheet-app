# SDLC Agent Setup Guide

Complete guide for setting up the Custom SDLC Agent that automates: **Jira Ticket → Implementation Plan → Code → Review → PR**.

## Architecture Overview

```
┌──────────┐     ┌────────────────┐     ┌──────────────┐     ┌──────────┐
│   JIRA   │────▶│  Devin Agent   │────▶│  Repository   │────▶│ GitHub PR│
│  Ticket  │     │  (Playbook)    │     │  (Code)       │     │          │
└──────────┘     └────────────────┘     └──────────────┘     └──────────┘
      │                  │                                         │
      │          ┌───────┴────────┐                                │
      │          │ Atlassian MCP  │                                │
      │          │ (Jira + Conf.) │                                │
      │          └────────────────┘                                │
      │                                                            │
      └────────────────── PR link posted back ─────────────────────┘
```

## Prerequisites

### 1. Jira Integration (Already Connected)

Your Devin org already has Jira connected. Verify at:
**Settings → Integrations → Jira**

### 2. Install Atlassian MCP Server

The Atlassian MCP gives Devin direct access to Jira tickets and Confluence docs.

1. Go to **Settings → MCP Marketplace**
2. Find **"Atlassian"** (Jira + Confluence)
3. Click **Setup** and follow the authentication flow
4. Grant access to your Jira project(s) and Confluence space(s)

Direct link: `https://<your-devin-instance>/settings/mcp-marketplace/setup/atlassian`

### 3. GitHub Integration (Already Connected)

Your Devin org already has GitHub connected. Verify at:
**Settings → Integrations → GitHub**

## Playbook Setup

### Option A: Use the Pre-Built Playbook

The playbook **"SDLC Agent - Jira Ticket to PR"** (macro: `!sdlc_agent`) has been created in your Devin org.

To use it:
1. Go to **Playbooks** in your Devin dashboard
2. Find **"SDLC Agent - Jira Ticket to PR"**
3. Attach it to a new Devin session, OR
4. Configure it as a Jira automation trigger (see below)

### Option B: Attach via Jira Label

1. Go to your **Jira integration settings** in Devin
2. Under **Playbook Labels**, add:
   - Label: `!sdlc_agent`
   - Playbook: "SDLC Agent - Jira Ticket to PR"
3. In Jira, create the label `!sdlc_agent` in your project
4. Add this label to any ticket to trigger the SDLC agent

## Triggering the Agent

### Method 1: Assign to Devin in Jira
Assign any Jira ticket directly to the Devin service account. It will use the default playbook.

### Method 2: Add Playbook Label in Jira
Add the `!sdlc_agent` label to a ticket. Devin starts a session with the SDLC agent playbook.

### Method 3: @Mention in Jira Comment
Comment on a ticket with `@Devin implement this ticket` — Devin reads the ticket and starts working.

### Method 4: Manual Session
Start a new Devin session and attach the "SDLC Agent - Jira Ticket to PR" playbook. Provide the Jira ticket ID in your prompt:
```
Implement PROJ-123 following the SDLC agent workflow.
```

## Workflow Phases

### Phase 1: Ticket Analysis
- Reads Jira ticket (summary, description, acceptance criteria)
- Fetches linked Confluence docs
- Posts understanding summary as Jira comment

### Phase 2: Implementation Plan
- Explores codebase structure and conventions
- Creates detailed plan (files to modify, approach, risks)
- Posts plan as Jira comment

### Phase 3: Code Implementation
- Creates feature branch: `feature/JIRA-ID-description`
- Implements changes following code conventions
- Runs lint, type checks, and tests

### Phase 4: Code Review (Self-Review)
- Reviews all changes against acceptance criteria
- Checks security, code quality, test coverage
- Fixes any issues found

### Phase 5: Commit & PR
- Pushes code and creates PR with full context
- Links PR to Jira ticket
- Waits for CI to pass
- Updates Jira ticket status

## Customization

### Adding New Repos

To add a new repository to the SDLC agent workflow:

1. Create an `AGENTS.md` file in the repo root (use this repo's AGENTS.md as a template)
2. Define:
   - Setup commands
   - Quality check commands (lint, test, build)
   - Code conventions
   - Branch/commit naming conventions
   - Forbidden actions

### Modifying the Playbook

Edit the playbook in **Devin → Playbooks → "SDLC Agent - Jira Ticket to PR"** to:
- Add/remove review checklist items
- Change branch naming conventions
- Add custom steps (e.g., database migrations, API documentation)
- Modify the PR template

### Adding Knowledge Notes

Create Devin Knowledge notes for:
- Team-specific coding standards
- Architecture decision records (ADRs)
- Common patterns and anti-patterns
- Deployment procedures

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Devin can't read Jira ticket | Verify Atlassian MCP is installed and has access to the project |
| PR fails CI | Check the AGENTS.md quality check commands are correct |
| Wrong branch naming | Update AGENTS.md branch naming convention |
| Devin doesn't follow conventions | Add more specific guidance in AGENTS.md or Knowledge notes |
| Ticket not triggering Devin | Check Jira integration settings and playbook label configuration |
