-- Users and routing
CREATE INDEX IF NOT EXISTS idx_users_role ON users (default_role);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_project_role ON project_stakeholders (project_id, stakeholder_role, active);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_user_active ON project_stakeholders (user_id, active);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_status_stage ON projects (project_status, stage);
CREATE INDEX IF NOT EXISTS idx_projects_priority_probability ON projects (commercial_priority, probability DESC);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects (expected_start_date);

-- Employees and search filters used by recommendations
CREATE INDEX IF NOT EXISTS idx_employees_name_hash ON employees (employee_name_hash);
CREATE INDEX IF NOT EXISTS idx_employees_discipline_grade ON employees (discipline, grade);
CREATE INDEX IF NOT EXISTS idx_employees_region_discipline ON employees (region, discipline);
CREATE INDEX IF NOT EXISTS idx_employees_domain ON employees (primary_domain, secondary_domain);

-- Skills used for candidate matching
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON employee_skills (skill_name);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill_level ON employee_skills (skill_name, skill_level);

-- Capacity used for availability filtering
CREATE INDEX IF NOT EXISTS idx_employee_capacity_status_fte ON employee_capacity (capacity_status, available_fte);
CREATE INDEX IF NOT EXISTS idx_employee_capacity_30_60_90 ON employee_capacity (available_30d_fte, available_60d_fte, available_90d_fte);
CREATE INDEX IF NOT EXISTS idx_employee_capacity_bench_risk ON employee_capacity (bench_risk);

-- Demand role filters
CREATE INDEX IF NOT EXISTS idx_project_roles_project_status ON project_roles (project_id, role_status);
CREATE INDEX IF NOT EXISTS idx_project_roles_discipline ON project_roles (discipline);
CREATE INDEX IF NOT EXISTS idx_project_roles_start_date ON project_roles (start_date);
CREATE INDEX IF NOT EXISTS idx_project_roles_required_skills_gin ON project_roles USING GIN (required_skills);
CREATE INDEX IF NOT EXISTS idx_project_roles_desired_skills_gin ON project_roles USING GIN (desired_skills);

-- Evidence drawer and explanation support
CREATE INDEX IF NOT EXISTS idx_employee_evidence_employee_type ON employee_evidence (employee_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_employee_evidence_project_role ON employee_evidence (project_id, role_id);

-- Booking history
CREATE INDEX IF NOT EXISTS idx_allocations_employee_status ON allocations (employee_id, allocation_status);
CREATE INDEX IF NOT EXISTS idx_allocations_project_role ON allocations (project_id, role_id);
CREATE INDEX IF NOT EXISTS idx_allocations_dates ON allocations (start_date, end_date);

-- Proposal workflow
CREATE INDEX IF NOT EXISTS idx_staffing_proposals_project_status ON staffing_proposals (project_id, proposal_status);
CREATE INDEX IF NOT EXISTS idx_proposal_candidates_role_status ON proposal_candidates (role_id, candidate_workflow_status);
CREATE INDEX IF NOT EXISTS idx_proposal_candidates_employee_status ON proposal_candidates (employee_id, candidate_workflow_status);
CREATE INDEX IF NOT EXISTS idx_proposal_candidates_ewa_status ON proposal_candidates (ewa_status);
CREATE INDEX IF NOT EXISTS idx_proposal_reviews_reviewer_decision ON proposal_reviews (reviewer_user_id, decision);
CREATE INDEX IF NOT EXISTS idx_proposal_reviews_proposal_role ON proposal_reviews (proposal_id, reviewer_role);

-- Audit and preserved source records
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_records_sheet_row ON source_records (sheet_name, row_number);
