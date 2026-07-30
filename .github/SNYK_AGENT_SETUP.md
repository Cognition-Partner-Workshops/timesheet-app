# Snyk Vulnerability Agent Setup Guide

Complete guide for setting up the Snyk Vulnerability Agent that automates: **Scan → Analyze → Remediate → PR**.

## Architecture Overview

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐     ┌──────────┐
│ Trigger       │────▶│  Devin Agent   │────▶│  Repository   │────▶│ GitHub PR│
│ (Jira/Sched.) │     │  (Playbook)    │     │  (Fixes)      │     │          │
└──────────────┘     └────────────────┘     └──────────────┘     └──────────┘
                             │
                     ┌───────┴────────┐
                     │   Snyk CLI /   │
                     │   Snyk MCP     │
                     └────────────────┘
```

## Prerequisites

### 1. Snyk Account & API Token

1. Sign up at [snyk.io](https://snyk.io) (free tier available)
2. Get your API token from **Account Settings → API Token**
3. Save the token as a Devin secret:
   - Name: `SNYK_TOKEN`
   - Scope: Organization (so all sessions can use it)

### 2. Snyk CLI Installation

The playbook will auto-install the Snyk CLI if needed, but for persistent setup, add to your Devin environment config:

```yaml
initialize: |
  npm install -g snyk
  snyk auth $SNYK_TOKEN
```

### 3. Snyk MCP Server (Optional — Enhanced Context)

For richer vulnerability context, set up the Snyk MCP server:

1. Go to **Devin Settings → MCP Marketplace → Add Your Own**
2. Use the configuration from [Snyk's Devin guide](https://docs.snyk.io/integrations/developer-guardrails-for-agentic-workflows/quickstart-guides-for-mcp/devin-guide)
3. Add the `SNYK_TOKEN` as an environment variable in the MCP config

Example custom MCP config:
```json
{
  "command": "npx",
  "args": ["-y", "@snyk/mcp-server"],
  "env": {
    "SNYK_TOKEN": "<your-snyk-token>"
  }
}
```

### 4. GitHub Integration (Already Connected)

Verify at: **Settings → Integrations → GitHub**

## Using the Agent

### Method 1: Devin Playbook (Recommended)

1. Start a new Devin session
2. Attach the **"Snyk Vulnerability Agent - Scan & Remediate"** playbook
3. Provide the target repo in your prompt:
   ```
   Scan Cognition-Partner-Workshops/app_timesheet for vulnerabilities and remediate any critical/high findings.
   ```

### Method 2: Jira Integration

1. Create a Jira ticket for vulnerability remediation
2. Add the `!snyk_agent` playbook label
3. Devin will scan, analyze, fix, and create a PR

### Method 3: Scheduled Scan

Set up a recurring Devin schedule:
1. Go to **Devin Settings → Schedules**
2. Create a new schedule:
   - **Name**: Weekly Snyk Vulnerability Scan
   - **Frequency**: `0 9 * * 1` (every Monday at 9 AM)
   - **Playbook**: Snyk Vulnerability Agent
   - **Prompt**: `Run a weekly vulnerability scan on Cognition-Partner-Workshops/app_timesheet. Create a remediation PR if any new critical/high vulnerabilities are found.`

### Method 4: Direct Command

In any Devin session:
```
Run a Snyk vulnerability scan on this repository. Fix all critical and high severity vulnerabilities and create a PR.
```

## Scan Types

| Scan Type | Command | What It Checks |
|-----------|---------|----------------|
| Open Source (SCA) | `snyk test` | npm/pip/maven dependency vulnerabilities |
| Code (SAST) | `snyk code test` | Source code security issues |
| Container | `snyk container test` | Docker image vulnerabilities |
| IaC | `snyk iac test` | Infrastructure-as-code misconfigurations |

## For This Repository (app-timesheet)

This Node.js app has two dependency trees to scan:

```bash
# Backend scan
cd backend && snyk test --json

# Frontend scan
cd frontend && snyk test --json

# Fallback (npm audit)
cd backend && npm audit --json
cd frontend && npm audit --json
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `snyk: command not found` | Run `npm install -g snyk` |
| Authentication failed | Verify `SNYK_TOKEN` is set: `snyk auth $SNYK_TOKEN` |
| Scan timeout | Use `--timeout=300` flag for large projects |
| No supported manifests | Check you're in the right directory with `package.json` |
| `snyk fix` not available | Use `npm audit fix` as fallback |
| Major version bump needed | Document in PR, do not auto-apply — flag for manual review |
