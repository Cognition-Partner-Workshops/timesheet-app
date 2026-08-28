const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default;
const { getDatabase } = require('../database/init');

const SYSTEM_PROMPT = `You are an intelligent assistant integrated into an Employee Time Tracking Application. Your role is to help users understand issues, analyze problems, and suggest fixes by leveraging your knowledge of the application's architecture and data.

## Application Overview
This is a full-stack time tracking app built with:
- **Backend**: Node.js, Express, SQLite (in-memory), JWT auth, Joi validation
- **Frontend**: React 19, TypeScript, Vite, Material UI, TanStack Query, React Router

## Database Schema
- **users**: email (PK), created_at
- **clients**: id (PK), name, description, department, email, user_email (FK), created_at, updated_at
- **work_entries**: id (PK), client_id (FK), user_email (FK), hours, description, date, created_at, updated_at

## API Endpoints
- POST /api/auth/login — Email-only login (no password)
- GET /api/auth/me — Current user info
- GET/POST /api/clients — List/create clients
- GET/PUT/DELETE /api/clients/:id — CRUD single client
- GET/POST /api/work-entries — List/create work entries (optional ?clientId filter)
- GET/PUT/DELETE /api/work-entries/:id — CRUD single work entry
- GET /api/reports/client/:clientId — Hourly report for a client
- GET /api/reports/export/csv/:clientId — CSV export
- GET /api/reports/export/pdf/:clientId — PDF export

## Key Architecture Notes
- Authentication uses x-user-email header (auto-provisioning on first login)
- Data is user-scoped via user_email filtering
- SQLite in-memory means data is lost on server restart
- Rate limiting: 100 requests per 15 minutes per IP
- JWT tokens expire in 24 hours
- Cascade delete: removing a client removes its work entries

## Common Issues & Patterns
1. Data loss on restart (in-memory SQLite)
2. Auth issues (missing/invalid email header)
3. Validation errors (Joi schema enforcement)
4. Rate limiting (100 req/15min)
5. CORS issues (frontend URL mismatch)
6. Report generation failures (invalid client ID, no entries)

## Your Capabilities
- Analyze reported issues and identify root causes
- Suggest code fixes with specific file paths and changes
- Explain application behavior and architecture
- Help debug errors by analyzing error messages
- Recommend best practices and improvements
- Provide SQL queries to investigate data issues
- Help with API usage and integration questions

When suggesting fixes, reference specific files:
- backend/src/server.js — Main Express server
- backend/src/routes/auth.js — Auth endpoints
- backend/src/routes/clients.js — Client CRUD
- backend/src/routes/workEntries.js — Work entry CRUD
- backend/src/routes/reports.js — Reports & exports
- backend/src/middleware/auth.js — JWT auth middleware
- backend/src/middleware/errorHandler.js — Error handling
- backend/src/database/init.js — DB initialization
- backend/src/validation/schemas.js — Joi validation schemas
- frontend/src/api/client.ts — API client
- frontend/src/contexts/AuthContext.tsx — Auth state
- frontend/src/pages/ — React page components

Always be specific, actionable, and reference actual code paths when suggesting fixes.`;

function getAppContext(db) {
  return new Promise((resolve) => {
    const context = {};

    db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
      context.userCount = err ? 'unknown' : row.count;

      db.get('SELECT COUNT(*) as count FROM clients', [], (err, row) => {
        context.clientCount = err ? 'unknown' : row.count;

        db.get('SELECT COUNT(*) as count FROM work_entries', [], (err, row) => {
          context.workEntryCount = err ? 'unknown' : row.count;

          db.get('SELECT SUM(hours) as total FROM work_entries', [], (err, row) => {
            context.totalHours = err ? 'unknown' : (row.total || 0);
            resolve(context);
          });
        });
      });
    });
  });
}

router.post('/message', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Chat service unavailable',
        details: 'ANTHROPIC_API_KEY environment variable is not configured. Please set it to enable the AI assistant.',
        fallback: true,
        response: getFallbackResponse(message)
      });
    }

    const db = getDatabase();
    const appContext = await getAppContext(db);

    const contextMessage = `\n\n[Current Application State]\n- Users registered: ${appContext.userCount}\n- Clients created: ${appContext.clientCount}\n- Work entries logged: ${appContext.workEntryCount}\n- Total hours tracked: ${appContext.totalHours}`;

    const anthropic = new Anthropic({ apiKey });

    const messages = [];

    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    messages.push({
      role: 'user',
      content: message + contextMessage
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I was unable to generate a response.';

    res.json({
      response: assistantMessage,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Chat error:', error);

    if (error.status === 401) {
      return res.status(503).json({
        error: 'Invalid API key',
        details: 'The configured ANTHROPIC_API_KEY is invalid. Please update it.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limited',
        details: 'Too many requests to the AI service. Please try again in a moment.'
      });
    }

    res.status(500).json({
      error: 'Chat service error',
      details: 'An unexpected error occurred while processing your message.',
      fallback: true,
      response: getFallbackResponse(req.body.message)
    });
  }
});

router.get('/status', (req, res) => {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    available: hasApiKey,
    model: 'claude-sonnet-4-20250514',
    features: [
      'Issue analysis and diagnosis',
      'Code fix suggestions',
      'Architecture explanations',
      'API usage help',
      'Data investigation queries',
      'Best practice recommendations'
    ]
  });
});

function getFallbackResponse(message) {
  const lower = (message || '').toLowerCase();

  if (lower.includes('data') && (lower.includes('lost') || lower.includes('gone') || lower.includes('disappear'))) {
    return 'This application uses an in-memory SQLite database. All data is lost when the backend server restarts. To fix this, modify `backend/src/database/init.js` to use a file-based SQLite database instead of `:memory:`. Change the Database constructor call to use a file path like `./data/timesheet.db`.';
  }

  if (lower.includes('login') || lower.includes('auth') || lower.includes('401')) {
    return 'Authentication uses email-only login with the x-user-email header. Common issues: 1) Missing email in localStorage, 2) Backend not receiving the header due to CORS, 3) JWT token expired (24h limit). Check the Network tab for the x-user-email header in requests.';
  }

  if (lower.includes('cors') || lower.includes('blocked')) {
    return 'CORS issues usually occur when FRONTEND_URL in the backend .env doesn\'t match the actual frontend URL. Check `backend/.env` and ensure FRONTEND_URL is set to `http://localhost:5173` for development.';
  }

  if (lower.includes('rate') || lower.includes('429') || lower.includes('too many')) {
    return 'The app has rate limiting set to 100 requests per 15 minutes per IP. This is configured in `backend/src/server.js`. For development, you can increase the `max` value in the rateLimit configuration.';
  }

  if (lower.includes('report') || lower.includes('export') || lower.includes('pdf') || lower.includes('csv')) {
    return 'Reports are generated via GET /api/reports/client/:clientId. Common issues: 1) Invalid client ID, 2) No work entries for the client, 3) PDF generation errors with PDFKit. Check that the client exists and has work entries before exporting.';
  }

  if (lower.includes('error') || lower.includes('bug') || lower.includes('fix')) {
    return 'To help diagnose the issue, please provide: 1) The error message you\'re seeing, 2) What action triggered it, 3) Any relevant network/console errors. Common areas to check: browser console, backend terminal output, and the Network tab in DevTools.';
  }

  return 'I can help you with issues in this time tracking application. Try asking about: data persistence, authentication problems, API errors, report generation, CORS issues, or describe any specific error you\'re encountering. Note: For full AI-powered analysis, please configure the ANTHROPIC_API_KEY environment variable.';
}

module.exports = router;
