# InSync — Workforce Planning Assistant

> **Right People, Right Opportunity.** An AI-assisted workforce planning MVP that
> helps managers find available employees and recommend staffing options for new
> opportunities. **AI surfaces evidence — people decide.**

InSync turns a plain-English opportunity ("*Need 2 Java developers, 1 QA engineer
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

---

## AI configuration (optional)

The app is **fully functional with no API key** — a deterministic mock parser and
mock explanation generator keep the demo working offline. To enable live AI, set
variables in `backend/.env`:

```bash
# OpenAI
INSYNC_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# …or Azure OpenAI
INSYNC_AI_PROVIDER=azure
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

Even with AI enabled, **the scoring engine still selects every candidate** — AI
output is restricted to parsing and narrating the engine's decision.

Other settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `INSYNC_DATA_FILE` | `data/workforce_dataset.xlsx` | Excel workbook to load |
| `INSYNC_SNAPSHOT_DATE` | `2026-06-22` | "Today" for availability maths (pinned to the dataset) |
| `INSYNC_FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

---

## Demo script (≈2 min)

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

## Key API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | KPI metrics + forecasts |
| GET | `/api/people` | Filtered people search |
| GET | `/api/people/{id}` | Full employee profile |
| POST | `/api/parse` | NL requirement → structured JSON |
| POST | `/api/recommend` | Structured requirement → 3 staffing options |
| POST | `/api/ewa` | Mock EWA submission (never books anyone) |
| GET | `/api/meta` | Filter vocabularies + AI status |
