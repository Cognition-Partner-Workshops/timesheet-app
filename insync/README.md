# TalentBridge — Workforce Planning Assistant

> **Right People. Right Opportunity.** An AI-assisted workforce planning app that
> helps managers find available employees and recommend staffing options for new
> opportunities. **AI surfaces evidence — people decide.**

> Evolved from the *InSync* MVP. TalentBridge adds **3-role authentication & RBAC**,
> a **PostgreSQL + pgvector retrieval pipeline**, a **role-aware chatbot**, and a
> **dark/light theme toggle** — while keeping the original deterministic scoring
> engine and pandas data layer fully intact.

TalentBridge turns a plain-English opportunity ("*Need 2 Java developers, 1 QA engineer
and 1 PM for a banking project in Pune starting in 30 days*") into structured role
demand, then a **deterministic Python scoring engine** ranks real employees from
the dataset and produces **three distinct staffing options**. AI is used *only* to
parse the request and explain the engine's picks — it never selects people.

---

## Architecture

```
insync/
├── backend/                 FastAPI + pandas
│   ├── app/
│   │   ├── main.py          App entrypoint, CORS, /api/meta + /api/health
│   │   ├── config.py        Env-driven config (data file, snapshot date, AI keys)
│   │   ├── data_layer.py    Loads all Excel sheets, joins on *_ID keys, indexes
│   │   ├── availability.py  Deterministic availability / free-FTE logic
│   │   ├── scoring.py       7-factor weighted scoring engine (the brain)
│   │   ├── recommend.py     Builds the 3 staffing strategies
│   │   ├── ai.py            NL parser + explanations (real OpenAI/Azure OR mock)
│   │   └── routers/         dashboard, people, opportunities, recommend, ewa
│   ├── data/workforce_dataset.xlsx
│   ├── requirements.txt
│   └── .env.example
└── frontend/                React + Vite + TypeScript
    └── src/
        ├── pages/           Dashboard, PeopleSearch, OpportunityIntake,
        │                    RecommendationResults, EWAApprovals
        ├── components/      CandidateDrawer (full scorecard + mock EWA submit)
        ├── api.ts           Axios client
        └── types.ts         Shared types mirroring the backend
```

### Scoring weights (deterministic, in `scoring.py`)

| Factor | Weight |
| --- | --- |
| Skill match | 35% |
| Availability match | 25% |
| Domain experience | 15% |
| Location match | 10% |
| Grade / seniority | 10% |
| Relevant project history | 5% |

### Availability logic (`availability.py`)

| Category | Meaning |
| --- | --- |
| Current Bench | Available now |
| Partial Capacity | Available for the free FTE they have |
| Rolling Off 0-30 | Available within 30 days |
| Rolling Off 31-60 | Available in 31–60 days |
| Rolling Off 61-90 | Available in 61–90 days |
| Allocated >90 | Not suitable for near-term roles |
| Booked | Excluded from fast/low-risk options; only surfaced as low confidence in best-match |

### Three staffing options (`recommend.py`)
- **Best overall match** — highest weighted scores (may include constrained people).
- **Fastest availability** — prioritises people who can start soonest.
- **Lowest risk / balanced team** — penalises booked/partial/missing-skill risk.

---

## Authentication & roles (RBAC)

Sign Up requires choosing one role; navigation, the landing page and chatbot scope
adapt to it (requirement §5–§7).

| Role | Lands on | Sees Dashboard? | Pages |
| --- | --- | --- | --- |
| **Workforce Planner** | Dashboard | ✅ | Dashboard · People Search · Opportunity Intake · EWA Approvals |
| **Delivery Manager** | People Search | ❌ | People Search · Opportunity Intake · EWA Approvals |
| **Client Manager** | Opportunity Intake | ❌ | People Search · Opportunity Intake · EWA Approvals |

Non-planners who open `/dashboard` get an **Access restricted** page; the backend
also enforces this (`/api/dashboard` returns 403). Auth uses PBKDF2 password
hashing + stateless HMAC-signed tokens (12h TTL); the React app stores the token
in `localStorage`. Three demo accounts are auto-seeded on startup (password
`demo1234`):

- `sarah@talentbridge.demo` — Workforce Planner
- `raj@talentbridge.demo` — Delivery Manager
- `jenny@talentbridge.demo` — Client Manager

## RAG pipeline (PostgreSQL + pgvector)

The chatbot retrieves evidence with pgvector before any explanation is generated
(requirement §2, §18):

```
Excel → clean → mask names/clients/projects → PostgreSQL core tables
      → retrieval documents → local embeddings (384-dim) → pgvector
question → embedding → pgvector cosine search → top masked docs
         → deterministic (or optional OpenAI) explanation
```

The ingestion code lives in `insync/loader/` (run its scripts to populate Postgres).
The chatbot **degrades gracefully**: if Postgres/pgvector is unreachable it falls
back to deterministic answers from the in-memory workbook, so the app always works.
Embeddings are produced by a local, deterministic feature-hashing embedder — no
paid embedding API or downloaded model required.

### Database config

| Variable | Default | Purpose |
| --- | --- | --- |
| `TB_PG_ENABLED` | `true` | Toggle pgvector retrieval on/off |
| `PGHOST` / `PGPORT` | `localhost` / `5432` | Postgres connection |
| `PGDATABASE` | `insync_wfp` | Database name |
| `PGUSER` / `PGPASSWORD` | `postgres` / `postgres` | Credentials |
| `TB_AUTH_SECRET` | demo default | Secret used to sign auth tokens |

---

## Setup

> Requires **Python 3.10+** and **Node 18+**.

### 1. Backend (FastAPI)

```bash
cd insync/backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional — works out of the box
uvicorn app.main:app --reload --port 8000
```

API is now on <http://localhost:8000> (docs at `/docs`).

### 2. Frontend (React)

```bash
cd insync/frontend
npm install
npm run dev
```

App is on <http://localhost:5173>. The Vite dev server proxies `/api` → `:8000`,
so no CORS setup is needed locally.

### 3. Backend tests

```bash
cd insync/backend
source .venv/bin/activate
pip install pytest
python -m pytest tests/ -q
```

Covers provider resolution by `LLM_PROVIDER` (incl. env-only Gemini→OpenAI
swap and safe fallback), read-only action detection, RBAC denial strings per
role, retrieval-backend selection, local-vector fallback, the
insufficient-evidence response, 7-section formatting and UUID masking. The
suite is DB-free (retrieval/lookups are stubbed) so it runs offline.

### RAG document / vector setup

The chatbot reads `rag_documents` / `retrieval_embeddings` from Postgres
(populated by the loader in `insync/loader/`). The **local-vector fallback** is
built automatically at startup when `backend/data/rag_vectors.json` is absent;
to (re)build it manually:

```bash
cd insync/backend && source .venv/bin/activate
python -c "from app import rag; print('built', rag.build_local_store(), 'docs')"
```

---

## AI configuration & provider abstraction

The app is **fully functional with no API key** — a deterministic mock parser and
mock explanation generator keep the demo working offline.

The LLM layer is **provider-independent** (`app/llm.py`):

```
AIProvider (interface: chat(messages, temperature) -> str | None)
  ├── GeminiProvider        (dev default)
  ├── OpenAIProvider        (production)
  ├── AzureOpenAIProvider
  └── MockProvider          (deterministic; returns None)
LLMService  → resolves the active provider ONLY from LLM_PROVIDER and
              fails safe to deterministic mode on any error.
```

The active provider is selected **only by the `LLM_PROVIDER` environment
variable** — switching providers is an environment change with **no code,
prompt, retrieval or RBAC changes**. API keys come exclusively from env vars and
are never hardcoded or logged.

```bash
# Development — Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash

# Production — OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# …or Azure OpenAI
LLM_PROVIDER=azure
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Offline / deterministic (default)
LLM_PROVIDER=mock
```

> `INSYNC_AI_PROVIDER` remains a backwards-compatible alias; `LLM_PROVIDER` wins
> when both are set. The resolved provider is logged once at startup (no secrets).

Even with AI enabled, **the scoring engine still selects every candidate** — AI
output is restricted to parsing and narrating the engine's decision.

### Read-only role-aware chatbot (`app/chat.py`)

The chatbot is a **read-only knowledge assistant** that answers **only from
retrieved evidence** and never performs business actions. Every request is
answered under an authenticated `UserContext` (`app/user_context.py`:
`userId, userName, userRole, accessibleProjects, accessibleAccounts,
accessibleEmployees, businessUnit, location`). Order of checks:

1. **Empty query** → prompt for input.
2. **Read-only block** — action-intent prompts (create/update/delete/approve/
   reject/assign/allocate/submit to EWA/generate proposal/trigger workflow/
   modify DB) return exactly:
   *"I can explain the process and answer questions about the available
   workforce planning data, but I cannot perform business actions or modify
   records."*
3. **RBAC scope block** — exact per-role denial strings:
   - Delivery Manager (out of scope): *"You do not have permission to access
     information outside your assigned projects."*
   - Client Partner (out of scope): *"You do not have permission to access
     opportunities outside your assigned customer accounts."*
   - Workforce Planner: enterprise-wide, no denial.
4. **Role-specific retrieval filtering** → retrieval → evidence-only answer in
   the 7-section format (Executive Summary, Key Findings, Supporting Evidence,
   Confidence Level, Risks / Constraints, Recommended Next Actions, EWA
   Considerations).
5. **Insufficient evidence** (no docs, or all below the relevance threshold) →
   exactly: *"I couldn't find enough information to answer that question."*

Internal UUID identifiers are masked in all human-facing text. Chat endpoints
are query-only and never call write services.

### Retrieval fallback chain (`app/rag.py`)

```
pgvector (primary)  →  local-vector store (cosine over locally-embedded
                       rag_documents, backend/data/rag_vectors.json)
                    →  insufficient-information response
```

`retrieval_enabled()` is true when **either** pgvector **or** the local store is
usable; `active_backend()` reports which one served each query (logged per
request). The local store is built at startup from `rag_documents` when absent
(`rag.build_local_store()`), so retrieval keeps working when pgvector is down.

Other settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `INSYNC_DATA_FILE` | `data/workforce_dataset.xlsx` | Excel workbook to load |
| `INSYNC_SNAPSHOT_DATE` | `2026-06-22` | "Today" for availability maths (pinned to the dataset) |
| `INSYNC_FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

---

## Demo script (≈3 min)

0. **Sign in** as `sarah@talentbridge.demo` / `demo1234` (Workforce Planner) — note
   the role badge and that the Dashboard nav item is present. Toggle dark/light
   with the ☀️/🌙 button (preference persists).
1. **Dashboard** — show total/bench/partial/roll-off/allocated/booked KPIs, the
   12-week supply forecast and bench-risk breakdown.
2. **People Search** — filter by skill = *Java*, availability = *Current Bench*;
   click a person to open the detail drawer.
3. **Opportunity Intake** — paste the banking example, click **Parse requirement**
   (note the structured JSON), then **Generate staffing options**.
4. **Recommendation Results** — switch between the three options; click a candidate
   to see the full scorecard, matched/missing skills, risks and next actions.
5. **Submit to EWA Approval** — shows "Recommendation sent to EWA for approval"
   and creates a mock request.
6. **EWA Approvals** — the submitted (mock) request appears in the queue.
7. **Chatbot** (💬, bottom-right) — ask *"Who is on the bench for a React role in
   Banking?"*; the answer cites pgvector-retrieved evidence.
8. **RBAC** — log out, sign in as `raj@talentbridge.demo` (Delivery Manager): the
   Dashboard nav is gone, `/dashboard` shows *Access restricted*, and org-wide
   bench analytics questions in the chatbot are redirected.

## Key API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | KPI metrics + forecasts |
| GET | `/api/people` | Filtered people search |
| GET | `/api/people/{id}` | Full employee profile |
| POST | `/api/parse` | NL requirement → structured JSON |
| POST | `/api/recommend` | Structured requirement → 3 staffing options |
| POST | `/api/ewa` | Mock EWA submission (never books anyone) |
| GET | `/api/meta` | Filter vocabularies + AI/retrieval status |
| GET | `/api/auth/roles` | List the three sign-up roles |
| POST | `/api/auth/signup` | Create an account (`full_name`, `email`, `password`, `role`) |
| POST | `/api/auth/signin` | Authenticate → token + user |
| GET | `/api/auth/me` | Current user (bearer token) |
| GET | `/api/chat` | Chatbot metadata + role-aware suggestions |
| POST | `/api/chat` | Ask a question → answer + retrieved evidence (RBAC-scoped) |
