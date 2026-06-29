# InSync Workforce Planning PostgreSQL Loader

This project loads the InSync hackathon Excel workbook into a simplified PostgreSQL schema.

It also includes a lightweight local RAG layer that creates retrieval documents, generates local embeddings, and searches them without a paid vector database.

## Architecture

The database is split into a small number of practical tables:

- `users`
- `projects`
- `project_stakeholders`
- `employees`
- `employee_skills`
- `employee_evidence`
- `employee_capacity`
- `project_roles`
- `allocations`
- `staffing_proposals`
- `proposal_candidates`
- `proposal_reviews`
- `audit_events`
- `source_records` for unmapped/reference sheets so source data is not lost
- `rag_documents` for masked retrieval text used by the RAG query flow

## Security design

Employee names are not masked in the application experience. They are encrypted in PostgreSQL using Fernet symmetric encryption.

- DB column: `employees.employee_name_encrypted`
- UI/backend can decrypt using `FERNET_KEY`
- Raw source JSON payloads mask `Employee_Name` unless `STORE_RAW_PII=true`
- Sensitive fields like SSN, national ID, passport, Aadhaar, PAN, phone and email are masked inside raw payloads

Generate a Fernet key:

```bash
python -m src.security.crypto --generate-key
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env
python run_import.py
```

For Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run_import.py
```

## Local RAG Flow

Run these after `python run_import.py` has successfully loaded the core tables.

```powershell
python scripts/create_rag_documents.py
python scripts/generate_embeddings.py
python scripts/query_rag.py "Who is available for a React role in banking?" --top-k 6
```

What each command does:

- `create_rag_documents.py` builds masked retrieval documents from employees, capacity, skills, evidence, projects, roles, and proposal candidates.
- `generate_embeddings.py` creates local embeddings in `vector_store/embeddings.npz`.
- `query_rag.py` embeds the user question, finds the closest retrieval documents, and prints an OpenAI-ready prompt.

This step does not require pgvector. It is intentionally local-first so the project works even when the PostgreSQL `vector` extension is unavailable.

## Excel to DB mapping

| Excel sheet | Loaded into |
|---|---|
| People | employees, employee_capacity |
| Skills | employee_skills, employee_evidence skill summary |
| Profiles | employee_evidence |
| Allocations | allocations, employee_capacity source payload |
| Bench | employee_capacity |
| Partial Capacity | employee_capacity |
| Availability Calendar | employee_capacity.availability_timeline JSON |
| Project History | employee_evidence |
| Opportunities | projects |
| Opportunity Roles | project_roles |
| Opportunity Overlays | employee_evidence |
| EWA Requests | staffing_proposals, proposal_candidates, proposal_reviews |
| Reference/unmapped sheets | source_records |

## How manager routing works

Every project has rows in `project_stakeholders`.

For MVP, every imported project is assigned to:

- Sarah as `WORKFORCE_PLANNER`
- Jenny as `CLIENT_MANAGER`
- Raj as `DELIVERY_MANAGER`

Later, add more project managers or client managers by inserting more rows into `users` and `project_stakeholders`.

## No background jobs

Availability is stored in `employee_capacity`. When the app reserves or books someone, update `employee_capacity` synchronously in the same transaction.

A sample booking transaction is included in `workflows/book_candidate_transaction.sql`.

## Important runtime query pattern

Recommendation should be scoped to one role at a time:

```sql
SELECT e.employee_id, e.employee_token, ec.available_fte, pr.required_skills
FROM project_roles pr
JOIN employees e ON e.discipline = pr.discipline
JOIN employee_capacity ec ON ec.employee_id = e.employee_id
WHERE pr.role_id = :role_id
  AND ec.available_fte >= pr.minimum_individual_fte;
```

Then score skills in application code or SQL for that specific role only.
