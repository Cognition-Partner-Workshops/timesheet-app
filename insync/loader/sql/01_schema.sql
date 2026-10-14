CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    default_role TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code TEXT UNIQUE NOT NULL,
    project_name TEXT,
    client_name TEXT,
    client_type TEXT,
    region TEXT,
    country TEXT,
    city TEXT,
    domain TEXT,
    stage TEXT,
    probability NUMERIC,
    commercial_priority TEXT,
    delivery_risk TEXT,
    expected_start_date DATE,
    duration_weeks INT,
    timezone_preference TEXT,
    project_status TEXT DEFAULT 'OPEN',
    approval_mode TEXT DEFAULT 'CLIENT_AND_DELIVERY',
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_stakeholders (
    stakeholder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    stakeholder_role TEXT NOT NULL,
    approval_required BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_project_stakeholder UNIQUE (project_id, user_id, stakeholder_role)
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT UNIQUE NOT NULL,
    employee_token TEXT UNIQUE NOT NULL,
    employee_name_encrypted TEXT,
    employee_name_hash TEXT,
    region TEXT,
    country TEXT,
    city TEXT,
    timezone TEXT,
    department TEXT,
    discipline TEXT,
    role_archetype TEXT,
    grade TEXT,
    career_level TEXT,
    primary_domain TEXT,
    secondary_domain TEXT,
    work_mode TEXT,
    employee_status TEXT DEFAULT 'ACTIVE',
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_skills (
    employee_skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    skill_category TEXT,
    skill_level INT,
    years_experience NUMERIC,
    last_used_date DATE,
    evidence_source TEXT,
    confidence TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_capacity (
    employee_id UUID PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    total_fte NUMERIC DEFAULT 1.0,
    allocated_fte NUMERIC DEFAULT 0.0,
    reserved_fte NUMERIC DEFAULT 0.0,
    available_fte NUMERIC DEFAULT 1.0,
    available_30d_fte NUMERIC DEFAULT 0.0,
    available_60d_fte NUMERIC DEFAULT 0.0,
    available_90d_fte NUMERIC DEFAULT 0.0,
    availability_category TEXT,
    release_window TEXT,
    expected_release_date DATE,
    capacity_status TEXT DEFAULT 'AVAILABLE',
    bench_type TEXT,
    bench_risk TEXT,
    time_on_bench_days INT,
    suggested_action TEXT,
    target_role_fit TEXT,
    ewa_action_required TEXT,
    availability_timeline JSONB,
    raw_payload JSONB,
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    role_code TEXT UNIQUE NOT NULL,
    role_name TEXT,
    discipline TEXT,
    grade_preference TEXT,
    required_skills TEXT[],
    desired_skills TEXT[],
    domain_experience_required TEXT,
    location_preference TEXT,
    start_date DATE,
    duration_weeks INT,
    required_fte NUMERIC,
    minimum_individual_fte NUMERIC DEFAULT 1.0,
    can_combine_candidates BOOLEAN DEFAULT false,
    priority TEXT,
    flexibility_notes TEXT,
    role_status TEXT DEFAULT 'OPEN',
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT UNIQUE NOT NULL,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    role_id UUID REFERENCES project_roles(role_id) ON DELETE SET NULL,
    evidence_type TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    evidence_text TEXT,
    score_json JSONB,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    role_id UUID REFERENCES project_roles(role_id) ON DELETE SET NULL,
    external_project_code TEXT,
    external_project_name TEXT,
    client_name TEXT,
    role_name TEXT,
    allocated_fte NUMERIC,
    start_date DATE,
    end_date DATE,
    allocation_status TEXT,
    source TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staffing_proposals (
    proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(user_id),
    proposal_status TEXT NOT NULL,
    selected_option_label TEXT,
    ai_summary TEXT,
    planner_note TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_candidates (
    proposal_candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT UNIQUE,
    external_ewa_code TEXT,
    proposal_id UUID NOT NULL REFERENCES staffing_proposals(proposal_id) ON DELETE CASCADE,
    role_id UUID REFERENCES project_roles(role_id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE SET NULL,
    proposed_fte NUMERIC,
    proposed_start_date DATE,
    proposed_end_date DATE,
    fit_score NUMERIC,
    risk_score NUMERIC,
    risk_level TEXT,
    reason_codes TEXT[],
    candidate_workflow_status TEXT,
    ewa_status TEXT,
    blocking_reason TEXT,
    next_action TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES staffing_proposals(proposal_id) ON DELETE CASCADE,
    stakeholder_id UUID NOT NULL REFERENCES project_stakeholders(stakeholder_id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(user_id),
    reviewer_role TEXT NOT NULL,
    decision TEXT DEFAULT 'PENDING',
    comment TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_proposal_review_stakeholder UNIQUE (proposal_id, stakeholder_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT,
    entity_id UUID,
    actor_user_id UUID REFERENCES users(user_id),
    actor_role TEXT,
    action TEXT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- Stores rows from reference sheets that are not part of the operational schema.
-- This prevents data loss without adding one table per reference sheet.
CREATE TABLE IF NOT EXISTS source_records (
    source_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_name TEXT NOT NULL,
    row_number INT NOT NULL,
    source_key TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    imported_at TIMESTAMP DEFAULT now()
);
